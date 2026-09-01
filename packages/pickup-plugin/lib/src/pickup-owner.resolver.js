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
exports.PickupOwnerResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shop_plugin_1 = require("@vendure/shop-plugin");
const pickup_redemption_entity_1 = require("./pickup-redemption.entity");
const pickup_service_1 = require("./pickup.service");
let PickupOwnerResolver = class PickupOwnerResolver {
    constructor(service) {
        this.service = service;
    }
    collected(r) {
        return this.service.effectiveCollected(r);
    }
    async myPickupOrders(ctx, args) {
        const [items, totalItems] = await this.service.myPickupOrders(ctx, args.options);
        return { items, totalItems };
    }
    async claimPickupByShop(ctx, code, collect) {
        return this.service.claimPickupByShop(ctx, code, collect);
    }
};
exports.PickupOwnerResolver = PickupOwnerResolver;
__decorate([
    (0, graphql_1.ResolveProperty)('collected'),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pickup_redemption_entity_1.PickupRedemption]),
    __metadata("design:returntype", Boolean)
], PickupOwnerResolver.prototype, "collected", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupOwnerResolver.prototype, "myPickupOrders", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __param(2, (0, graphql_1.Args)('collect', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Boolean]),
    __metadata("design:returntype", Promise)
], PickupOwnerResolver.prototype, "claimPickupByShop", null);
exports.PickupOwnerResolver = PickupOwnerResolver = __decorate([
    (0, graphql_1.Resolver)('PickupRedemption'),
    __metadata("design:paramtypes", [pickup_service_1.PickupService])
], PickupOwnerResolver);
//# sourceMappingURL=pickup-owner.resolver.js.map