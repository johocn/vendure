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
exports.DeliveryShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const delivery_range_entity_1 = require("./delivery-range.entity");
const delivery_service_1 = require("./delivery.service");
let DeliveryShopResolver = class DeliveryShopResolver {
    constructor(deliveryService, orderService, connection) {
        this.deliveryService = deliveryService;
        this.orderService = orderService;
        this.connection = connection;
    }
    async myDeliveryAddresses(ctx) {
        return this.deliveryService.listMyAddresses(ctx);
    }
    async createDeliveryAddress(ctx, input) {
        return this.deliveryService.createAddress(ctx, input);
    }
    async updateDeliveryAddress(ctx, id, input) {
        return this.deliveryService.updateAddress(ctx, id, input);
    }
    async deleteDeliveryAddress(ctx, id) {
        return this.deliveryService.deleteAddress(ctx, id);
    }
    async setDefaultDeliveryAddress(ctx, id) {
        return this.deliveryService.setDefaultAddress(ctx, id);
    }
    async shopDeliveryRange(ctx, shopId) {
        return this.deliveryService.getRange(ctx, shopId);
    }
    async validateDelivery(ctx, input) {
        return this.deliveryService.validateDelivery(ctx, input.address, input.shopIds);
    }
    async activeOrderDeliveryStatus(ctx) {
        var _a;
        const activeOrderId = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.activeOrderId;
        if (!activeOrderId) {
            return null;
        }
        const order = await this.orderService.findOne(ctx, activeOrderId);
        if (!order) {
            return null;
        }
        // 未设置收件区码/经纬度 → 无可预检结果
        if (!this.deliveryService.hasOrderShippingCodes(order)) {
            return null;
        }
        const results = await this.deliveryService.evaluateOrderDelivery(ctx, order);
        const deliverable = results.every((r) => r.inRange);
        return { deliverable, results };
    }
    async setOrderShippingFromAddress(ctx, deliveryAddressId) {
        var _a;
        const addr = await this.deliveryService.getAddress(ctx, deliveryAddressId);
        const activeOrderId = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.activeOrderId;
        if (activeOrderId) {
            const order = await this.orderService.findOne(ctx, activeOrderId);
            if (order) {
                this.deliveryService.applyAddressToOrderShipping(order, addr);
                await this.connection
                    .getRepository(ctx, core_1.Order)
                    .save(order, { reload: false });
            }
        }
        else {
            throw new core_1.EntityNotFoundError('Order', deliveryAddressId);
        }
        return addr;
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
exports.DeliveryShopResolver = DeliveryShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "myDeliveryAddresses", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "createDeliveryAddress", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "updateDeliveryAddress", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "deleteDeliveryAddress", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "setDefaultDeliveryAddress", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "shopDeliveryRange", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "validateDelivery", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "activeOrderDeliveryStatus", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('deliveryAddressId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryShopResolver.prototype, "setOrderShippingFromAddress", null);
__decorate([
    (0, graphql_1.ResolveField)('districtCodes'),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_range_entity_1.DeliveryRange]),
    __metadata("design:returntype", Object)
], DeliveryShopResolver.prototype, "districtCodes", null);
exports.DeliveryShopResolver = DeliveryShopResolver = __decorate([
    (0, graphql_1.Resolver)('DeliveryRange'),
    __metadata("design:paramtypes", [delivery_service_1.DeliveryService,
        core_1.OrderService,
        core_1.TransactionalConnection])
], DeliveryShopResolver);
//# sourceMappingURL=delivery-shop.resolver.js.map