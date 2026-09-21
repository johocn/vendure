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
exports.ShippingProfileAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const delivery_facet_service_1 = require("./delivery-facet.service");
const shipping_profile_service_1 = require("./shipping-profile.service");
const shipping_profile_permissions_1 = require("./shipping-profile-permissions");
let ShippingProfileAdminResolver = class ShippingProfileAdminResolver {
    constructor(service, deliveryFacetService) {
        this.service = service;
        this.deliveryFacetService = deliveryFacetService;
    }
    /**
     * facet 只是配送能力的「派生索引」，同步失败不应让档案写操作报错/回滚
     * （否则商户改一次档案就整单失败）。失败只记日志，索引由下次档案变更重建。
     */
    async syncFacetSilently(action) {
        var _a;
        try {
            await action();
        }
        catch (e) {
            core_1.Logger.warn(`配送 facet 同步失败（不影响本次写入）：${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    }
    async shippingProfiles(ctx, options) {
        return this.service.findAll(ctx, options);
    }
    async shippingProfile(ctx, id) {
        return this.service.findOne(ctx, id);
    }
    async createShippingProfile(ctx, input) {
        const profile = await this.service.create(ctx, input);
        await this.syncFacetSilently(() => this.deliveryFacetService.rebuildChannel(ctx));
        return profile;
    }
    async updateShippingProfile(ctx, input) {
        const profile = await this.service.update(ctx, input);
        await this.syncFacetSilently(() => this.deliveryFacetService.rebuildChannel(ctx));
        return profile;
    }
    async deleteShippingProfile(ctx, id) {
        await this.service.delete(ctx, id);
        await this.syncFacetSilently(() => this.deliveryFacetService.rebuildChannel(ctx));
        return true;
    }
    async assignShippingProfile(ctx, variantIds, profileId) {
        await this.service.assignToVariants(ctx, variantIds, profileId);
        await this.syncFacetSilently(() => this.deliveryFacetService.syncVariants(ctx, variantIds));
        return true;
    }
    async setTenantDefaultShippingProfile(ctx, id) {
        await this.service.setTenantDefault(ctx, id);
        await this.syncFacetSilently(() => this.deliveryFacetService.rebuildChannel(ctx));
        return true;
    }
    /**
     * 手动重建本渠道的配送筛选索引（facet 只在档案写操作时维护，存量渠道需要补一次）。
     * 与档案变更时的静默同步不同，这里失败要抛错——用户是显式点「重建」。
     */
    async rebuildDeliveryFacetIndex(ctx) {
        await this.deliveryFacetService.rebuildChannel(ctx);
        return true;
    }
};
exports.ShippingProfileAdminResolver = ShippingProfileAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shipping_profile_permissions_1.shippingProfilePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShippingProfileAdminResolver.prototype, "shippingProfiles", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shipping_profile_permissions_1.shippingProfilePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShippingProfileAdminResolver.prototype, "shippingProfile", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(shipping_profile_permissions_1.shippingProfilePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShippingProfileAdminResolver.prototype, "createShippingProfile", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(shipping_profile_permissions_1.shippingProfilePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShippingProfileAdminResolver.prototype, "updateShippingProfile", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(shipping_profile_permissions_1.shippingProfilePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShippingProfileAdminResolver.prototype, "deleteShippingProfile", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(shipping_profile_permissions_1.shippingProfilePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantIds')),
    __param(2, (0, graphql_1.Args)('profileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array, Object]),
    __metadata("design:returntype", Promise)
], ShippingProfileAdminResolver.prototype, "assignShippingProfile", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(shipping_profile_permissions_1.shippingProfilePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShippingProfileAdminResolver.prototype, "setTenantDefaultShippingProfile", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(shipping_profile_permissions_1.shippingProfilePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], ShippingProfileAdminResolver.prototype, "rebuildDeliveryFacetIndex", null);
exports.ShippingProfileAdminResolver = ShippingProfileAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [shipping_profile_service_1.ShippingProfileService,
        delivery_facet_service_1.DeliveryFacetService])
], ShippingProfileAdminResolver);
//# sourceMappingURL=shipping-profile-admin.resolver.js.map