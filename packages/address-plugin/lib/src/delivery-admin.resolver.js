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
exports.DeliveryAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const delivery_range_entity_1 = require("./delivery-range.entity");
const delivery_service_1 = require("./delivery.service");
let DeliveryAdminResolver = class DeliveryAdminResolver {
    constructor(deliveryService) {
        this.deliveryService = deliveryService;
    }
    async deliveryRange(ctx, shopId) {
        return this.deliveryService.getRange(ctx, shopId);
    }
    async upsertDeliveryRange(ctx, input) {
        return this.deliveryService.upsertRange(ctx, input);
    }
    districtCodes(range) {
        const raw = range.districtCodes;
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        }
        catch (_a) {
            return null;
        }
    }
};
exports.DeliveryAdminResolver = DeliveryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "deliveryRange", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "upsertDeliveryRange", null);
__decorate([
    (0, graphql_1.ResolveField)('districtCodes'),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_range_entity_1.DeliveryRange]),
    __metadata("design:returntype", Object)
], DeliveryAdminResolver.prototype, "districtCodes", null);
exports.DeliveryAdminResolver = DeliveryAdminResolver = __decorate([
    (0, graphql_1.Resolver)('DeliveryRange'),
    __metadata("design:paramtypes", [delivery_service_1.DeliveryService])
], DeliveryAdminResolver);
//# sourceMappingURL=delivery-admin.resolver.js.map