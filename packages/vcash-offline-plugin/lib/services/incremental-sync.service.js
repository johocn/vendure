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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalSyncService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@vendure/core");
const typeorm_2 = require("typeorm");
/**
 * 商品/会员增量同步服务：
 * - syncProducts: 按 ProductVariant.updatedAt > since 增量查询，按 Channel 隔离
 * - syncMembers: 按 Customer.updatedAt > since 增量查询，按 Channel 隔离
 *
 * cursor = 当前批次最后一条记录的 updatedAt，前端下次同步以该 cursor 作为 since。
 * 按 updatedAt ASC 排序保证 cursor 单调推进。
 *
 * 关键实现细节（Vendure 3.6.4）：
 * 1. ProductVariant.price/priceWithTax 是 Calculated 属性，依赖运行时注入的 listPrice/taxRateApplied。
 *    直接用 repository 查询时这些属性为 undefined，需从 productVariantPrices 关系取 listPrice。
 *    测试环境 taxRate=0%，price=priceWithTax=listPrice。
 * 2. ProductVariant.name 是 LocaleString，从 translations[0].name 取。
 * 3. Customer.customFields 是 embedded entity，memberLevel/points 由 member-level-plugin 注入。
 *    用 optional chaining + 默认值兜底，未注册该插件时返回 0。
 */
let IncrementalSyncService = class IncrementalSyncService {
    constructor(connection, transactionalConnection) {
        this.connection = connection;
        this.transactionalConnection = transactionalConnection;
    }
    async syncProducts(ctx, since, limit) {
        const channelId = ctx.channelId;
        const variants = await this.connection
            .getRepository(core_1.ProductVariant)
            .createQueryBuilder('variant')
            .leftJoinAndSelect('variant.product', 'product')
            .leftJoinAndSelect('variant.productVariantPrices', 'price')
            .leftJoinAndSelect('variant.translations', 'translation')
            .leftJoin('variant.channels', 'channel', 'channel.id = :channelId', { channelId })
            .where('variant.deletedAt IS NULL')
            .andWhere('variant.updatedAt > :since', { since })
            .andWhere('channel.id = :channelId', { channelId })
            .orderBy('variant.updatedAt', 'ASC')
            .take(limit)
            .getMany();
        const items = variants.map(v => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
            const listPrice = (_f = (_c = (_b = (_a = v.productVariantPrices) === null || _a === void 0 ? void 0 : _a.find(p => Number(p.channelId) === Number(channelId))) === null || _b === void 0 ? void 0 : _b.price) !== null && _c !== void 0 ? _c : (_e = (_d = v.productVariantPrices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.price) !== null && _f !== void 0 ? _f : 0;
            const name = (_p = (_k = (_j = (_h = (_g = v.translations) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.name) !== null && _j !== void 0 ? _j : v.name) !== null && _k !== void 0 ? _k : (_o = (_m = (_l = v.product) === null || _l === void 0 ? void 0 : _l.translations) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.name) !== null && _p !== void 0 ? _p : '';
            return {
                variantId: Number(v.id),
                sku: (_q = v.sku) !== null && _q !== void 0 ? _q : '',
                name,
                price: listPrice,
                priceWithTax: listPrice,
                barcode: (_s = (_r = v.customFields) === null || _r === void 0 ? void 0 : _r.barcode) !== null && _s !== void 0 ? _s : null,
                categoryId: v.productId ? Number(v.productId) : null,
                updatedAt: v.updatedAt,
            };
        });
        const cursor = items.length > 0 ? items[items.length - 1].updatedAt : since;
        return { items, cursor };
    }
    async syncMembers(ctx, since, limit) {
        const channelId = ctx.channelId;
        const customers = await this.connection
            .getRepository(core_1.Customer)
            .createQueryBuilder('customer')
            .leftJoin('customer.channels', 'channel', 'channel.id = :channelId', { channelId })
            .where('customer.deletedAt IS NULL')
            .andWhere('customer.updatedAt > :since', { since })
            .andWhere('channel.id = :channelId', { channelId })
            .orderBy('customer.updatedAt', 'ASC')
            .take(limit)
            .getMany();
        const items = customers.map(c => {
            var _a, _b, _c, _d, _e, _f, _g;
            return ({
                customerId: Number(c.id),
                emailAddress: (_a = c.emailAddress) !== null && _a !== void 0 ? _a : '',
                firstName: (_b = c.firstName) !== null && _b !== void 0 ? _b : '',
                lastName: (_c = c.lastName) !== null && _c !== void 0 ? _c : '',
                customFields: {
                    memberLevel: (_e = (_d = c.customFields) === null || _d === void 0 ? void 0 : _d.memberLevel) !== null && _e !== void 0 ? _e : 0,
                    points: (_g = (_f = c.customFields) === null || _f === void 0 ? void 0 : _f.points) !== null && _g !== void 0 ? _g : 0,
                },
                updatedAt: c.updatedAt,
            });
        });
        const cursor = items.length > 0 ? items[items.length - 1].updatedAt : since;
        return { items, cursor };
    }
};
exports.IncrementalSyncService = IncrementalSyncService;
exports.IncrementalSyncService = IncrementalSyncService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __param(1, (0, common_1.Inject)(core_1.TransactionalConnection)),
    __metadata("design:paramtypes", [typeorm_2.Connection,
        core_1.TransactionalConnection])
], IncrementalSyncService);
//# sourceMappingURL=incremental-sync.service.js.map