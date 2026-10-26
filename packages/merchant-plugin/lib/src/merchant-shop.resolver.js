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
exports.MerchantShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const merchant_store_service_1 = require("./merchant-store.service");
/**
 * 门店 C 端公开 API：附近门店列表与门店详情。
 * 仅返回 enabled && isPublic && 未删除 && 非 CLOSED 的门店。
 */
let MerchantShopResolver = class MerchantShopResolver {
    constructor(merchantStoreService) {
        this.merchantStoreService = merchantStoreService;
    }
    async merchantStores(ctx, lat, lng, city, merchantId, limit) {
        return this.merchantStoreService.findNearby(ctx, { lat, lng, city, merchantId, limit });
    }
    async merchantStorePublic(ctx, id) {
        const [store] = await this.merchantStoreService.findPublicByIds(ctx, [id]);
        if (!store) {
            throw new core_1.UserInputError('门店不存在或未公开');
        }
        return this.merchantStoreService.toPublic(store, { locale: ctx.languageCode });
    }
};
exports.MerchantShopResolver = MerchantShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'lat', type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'lng', type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'city', type: () => String, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'merchantId', type: () => String, nullable: true })),
    __param(5, (0, graphql_1.Args)({ name: 'limit', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number, String, Object, Number]),
    __metadata("design:returntype", Promise)
], MerchantShopResolver.prototype, "merchantStores", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantShopResolver.prototype, "merchantStorePublic", null);
exports.MerchantShopResolver = MerchantShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [merchant_store_service_1.MerchantStoreService])
], MerchantShopResolver);
//# sourceMappingURL=merchant-shop.resolver.js.map