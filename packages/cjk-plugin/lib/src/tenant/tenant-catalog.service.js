"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantCatalogService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
let TenantCatalogService = class TenantCatalogService {
    constructor(collectionService, channelService, connection) {
        this.collectionService = collectionService;
        this.channelService = channelService;
        this.connection = connection;
    }
    /** 解析 productIds 参数值：Vendure ConfigArg 中 list 型参数以 JSON 字符串存储（如 '[60]' / '["60"]'），兼容数组。 */
    parseIdList(value) {
        if (Array.isArray(value))
            return value.map(String);
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.map(String) : [];
            }
            catch (_a) {
                return value ? [value] : [];
            }
        }
        return [];
    }
    /**
     * 创建租户分类后，主动从默认渠道摘除，实现「租户分类只挂租户渠道、进默认商城」双轨隔离。
     * 不能走 removeCollectionsFromChannel（会对默认渠道抛错），须直接 channelService.removeFromChannels。
     */
    async createTenantCollection(ctx, input) {
        const collection = await this.collectionService.create(ctx, input);
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        if (!(0, core_1.idsAreEqual)(defaultChannel.id, ctx.channelId)) {
            await this.channelService.removeFromChannels(ctx, core_1.Collection, collection.id, [
                defaultChannel.id,
            ]);
        }
        return (0, core_1.assertFound)(this.collectionService.findOne(ctx, collection.id));
    }
    /** 把商品 ID 追加进平台分类的 productId 过滤器（只增；非 productId 独过滤器则新建一条 productId 过滤器，不改其它过滤器）。 */
    async addProductToCollection(ctx, productId, collectionId) {
        var _a, _b, _c;
        const repo = this.connection.getRepository(ctx, core_1.Collection);
        const collection = await repo.findOne({
            where: { id: String(collectionId) },
        });
        if (!collection)
            return;
        // Vendure ConfigurableOperation 标准形态：{ code, args: [{name, value}] }，list 参数值存 JSON 字符串。
        const filters = (_a = collection.filters) !== null && _a !== void 0 ? _a : [];
        const productIdFilter = filters.find(f => f.code === 'product-id-filter');
        if (productIdFilter) {
            const idsArg = (_b = productIdFilter.args) === null || _b === void 0 ? void 0 : _b.find(a => a.name === 'productIds');
            const existing = this.parseIdList(idsArg === null || idsArg === void 0 ? void 0 : idsArg.value);
            if (!existing.includes(String(productId))) {
                const newValue = JSON.stringify([...existing, String(productId)]);
                if (idsArg) {
                    idsArg.value = newValue;
                }
                else {
                    (productIdFilter.args = (_c = productIdFilter.args) !== null && _c !== void 0 ? _c : []).push({
                        name: 'productIds',
                        value: newValue,
                    });
                }
            }
        }
        else {
            filters.push({
                code: 'product-id-filter',
                args: [
                    { name: 'productIds', value: JSON.stringify([String(productId)]) },
                    { name: 'combineWithAnd', value: 'false' },
                ],
            });
        }
        // 用 repo.update 显式只更新 filters 列（无条件发 UPDATE，绕开 TypeORM save() 对 simple-json 的引用级脏检测，确保真正持久化）。
        await repo.update(collection.id, { filters });
        // 重新计算该分类的变体成员，使商品立即出现在分类列表页（等价 updateCollection 的 applyCollectionFilters）。
        await this.collectionService.triggerApplyFiltersJob(ctx, {
            collectionIds: [collection.id],
        });
    }
    /**
     * 把商品挂到租户渠道并从默认渠道摘除（双轨隔离）。
     * 不能走 removeProductsFromChannel（会被「默认渠道不可摘除」守卫拦），须直接 channelService.removeFromChannels。
     */
    async moveProductsToTenantChannel(ctx, productIds, channelId) {
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            throw new core_1.InternalServerError(`Channel not found: ${channelId}`);
        const result = [];
        for (const id of productIds) {
            if (!(0, core_1.idsAreEqual)(channel.id, defaultChannel.id)) {
                await this.channelService.assignToChannels(ctx, core_1.Product, id, [channel.id]);
            }
            await this.channelService.removeFromChannels(ctx, core_1.Product, id, [defaultChannel.id]);
            const p = await this.connection
                .getRepository(ctx, core_1.Product)
                .findOne({ where: { id: String(id) } });
            if (p)
                result.push(p);
        }
        return result;
    }
};
exports.TenantCatalogService = TenantCatalogService;
exports.TenantCatalogService = TenantCatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.CollectionService,
        core_1.ChannelService,
        core_1.TransactionalConnection])
], TenantCatalogService);
//# sourceMappingURL=tenant-catalog.service.js.map