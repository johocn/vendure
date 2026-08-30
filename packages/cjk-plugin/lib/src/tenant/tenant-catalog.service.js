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
        var _a, _b;
        const repo = this.connection.getRepository(ctx, core_1.Collection);
        const collection = await repo.findOne({
            where: { id: String(collectionId) },
            relations: ['channels'],
        });
        if (!collection)
            return;
        const filters = (_a = collection.filters) !== null && _a !== void 0 ? _a : [];
        const productIdFilter = filters.find((f) => f.code === 'product-id-filter');
        if (productIdFilter) {
            const arg = (_b = productIdFilter.arguments) === null || _b === void 0 ? void 0 : _b.find((a) => a.name === 'productIds');
            const existing = arg ? JSON.parse(arg.value || '[]') : [];
            if (!existing.includes(String(productId))) {
                const target = arg !== null && arg !== void 0 ? arg : { name: 'productIds', value: '[]' };
                target.value = JSON.stringify([...existing, String(productId)]);
                if (!productIdFilter.arguments) {
                    productIdFilter.arguments = [target];
                }
                else if (!productIdFilter.arguments.includes(target)) {
                    productIdFilter.arguments.push(target);
                }
            }
        }
        else {
            filters.push({
                code: 'product-id-filter',
                arguments: [
                    { name: 'productIds', value: JSON.stringify([String(productId)]) },
                    { name: 'combineWithAnd', value: 'false' },
                ],
            });
        }
        collection.filters = filters;
        await repo.save(collection);
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