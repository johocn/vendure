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
exports.ShippingProfileShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shipping_profile_service_1 = require("./shipping-profile.service");
let ShippingProfileShopResolver = class ShippingProfileShopResolver {
    constructor(service) {
        this.service = service;
    }
    async eligibleShippingMethodsByProfile(ctx, profileIds) {
        const intersected = await this.service.getIntersectedShippingMethods(ctx, profileIds);
        if (intersected.length === 0)
            return [];
        return this.service.findShippingMethodsByIds(ctx, intersected.map(m => m.id));
    }
    async checkShippingProfileCompatibility(ctx, profileIds) {
        const methods = await this.service.getIntersectedShippingMethods(ctx, profileIds);
        return {
            compatible: methods.length > 0,
            intersectedCount: methods.length,
        };
    }
    /**
     * 按 Profile 交集查询允许的自提点。
     * 返回值语义：
     * - []  → 所有 Profile 都未约束自提点（前端展示全部），或交集为空（前端展示"无可用"）
     * - [locations] → 交集非空，前端仅展示这些自提点
     * 前端需配合 checkPickupLocationConstraint 查询区分两种 [] 情况
     */
    async eligiblePickupLocationsByProfile(ctx, profileIds) {
        const ids = await this.service.getIntersectedPickupLocations(ctx, profileIds);
        if (ids === null || ids.length === 0)
            return [];
        return await this.service.findPickupLocationsByIds(ctx, ids);
    }
    async checkPickupLocationConstraint(ctx, profileIds) {
        return this.service.hasPickupLocationConstraint(ctx, profileIds);
    }
};
exports.ShippingProfileShopResolver = ShippingProfileShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "eligibleShippingMethodsByProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "checkShippingProfileCompatibility", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "eligiblePickupLocationsByProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "checkPickupLocationConstraint", null);
exports.ShippingProfileShopResolver = ShippingProfileShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [shipping_profile_service_1.ShippingProfileService])
], ShippingProfileShopResolver);
//# sourceMappingURL=shipping-profile-shop.resolver.js.map