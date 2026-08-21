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
exports.PickupCustomerResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const pickup_service_1 = require("./pickup.service");
let PickupCustomerResolver = class PickupCustomerResolver {
    constructor(service) {
        this.service = service;
    }
    async myPickupCode(ctx, orderId) {
        return this.service.resolveMyPickupCode(ctx, orderId);
    }
    async claimMyPickup(ctx, orderId, code) {
        return this.service.claimMyPickup(ctx, orderId, code);
    }
};
exports.PickupCustomerResolver = PickupCustomerResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupCustomerResolver.prototype, "myPickupCode", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], PickupCustomerResolver.prototype, "claimMyPickup", null);
exports.PickupCustomerResolver = PickupCustomerResolver = __decorate([
    (0, graphql_1.Resolver)('PickupRedemption'),
    __metadata("design:paramtypes", [pickup_service_1.PickupService])
], PickupCustomerResolver);
//# sourceMappingURL=pickup-customer.resolver.js.map