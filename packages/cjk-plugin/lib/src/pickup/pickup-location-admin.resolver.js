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
exports.PickupLocationAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const pickup_location_service_1 = require("./pickup-location.service");
let PickupLocationAdminResolver = class PickupLocationAdminResolver {
    constructor(pickupLocationService) {
        this.pickupLocationService = pickupLocationService;
    }
    async pickupLocations(ctx, options) {
        return this.pickupLocationService.findAll(ctx, options);
    }
    async pickupLocation(ctx, id) {
        return this.pickupLocationService.findOne(ctx, id);
    }
    async createPickupLocation(ctx, input) {
        return this.pickupLocationService.create(ctx, input);
    }
    async updatePickupLocation(ctx, input) {
        return this.pickupLocationService.update(ctx, input);
    }
    async deletePickupLocation(ctx, id) {
        await this.pickupLocationService.delete(ctx, id);
        return true;
    }
};
exports.PickupLocationAdminResolver = PickupLocationAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupLocationAdminResolver.prototype, "pickupLocations", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupLocationAdminResolver.prototype, "pickupLocation", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupLocationAdminResolver.prototype, "createPickupLocation", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupLocationAdminResolver.prototype, "updatePickupLocation", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupLocationAdminResolver.prototype, "deletePickupLocation", null);
exports.PickupLocationAdminResolver = PickupLocationAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [pickup_location_service_1.PickupLocationService])
], PickupLocationAdminResolver);
//# sourceMappingURL=pickup-location-admin.resolver.js.map