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
const shipping_profile_service_1 = require("./shipping-profile.service");
const shipping_profile_permissions_1 = require("./shipping-profile-permissions");
let ShippingProfileAdminResolver = class ShippingProfileAdminResolver {
    constructor(service) {
        this.service = service;
    }
    async shippingProfiles(ctx, options) {
        return this.service.findAll(ctx, options);
    }
    async shippingProfile(ctx, id) {
        return this.service.findOne(ctx, id);
    }
    async createShippingProfile(ctx, input) {
        return this.service.create(ctx, input);
    }
    async updateShippingProfile(ctx, input) {
        return this.service.update(ctx, input);
    }
    async deleteShippingProfile(ctx, id) {
        await this.service.delete(ctx, id);
        return true;
    }
    async assignShippingProfile(ctx, variantIds, profileId) {
        await this.service.assignToVariants(ctx, variantIds, profileId);
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
exports.ShippingProfileAdminResolver = ShippingProfileAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [shipping_profile_service_1.ShippingProfileService])
], ShippingProfileAdminResolver);
//# sourceMappingURL=shipping-profile-admin.resolver.js.map