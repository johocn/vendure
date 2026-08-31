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
exports.PickupGuestOrderResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const pickup_service_1 = require("./pickup.service");
const pickup_redemption_entity_1 = require("./pickup-redemption.entity");
const pickup_guest_order_1 = require("./pickup-guest-order");
const ERR_NOT_FOUND = 'GUEST_ORDER_NOT_FOUND';
let PickupGuestOrderResolver = class PickupGuestOrderResolver {
    constructor(orderService, configService, connection, service) {
        this.orderService = orderService;
        this.configService = configService;
        this.connection = connection;
        this.service = service;
    }
    async guestOrderLookup(ctx, input) {
        const order = await this.loadOrder(ctx, input.orderCode);
        if (!order)
            throw new core_1.UserInputError(ERR_NOT_FOUND);
        const windowAccess = input.phone
            ? false
            : await this.configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order);
        if (!(0, pickup_guest_order_1.guestLookupAllowed)(order, input, windowAccess).allowed) {
            throw new core_1.UserInputError(ERR_NOT_FOUND);
        }
        await this.service.ensurePickupRedemptionForOrder(ctx, order.id).catch(() => undefined);
        const redemption = await this.findRedemption(ctx, order.id);
        const pickupLocation = await this.resolvePickupLocation(ctx, order);
        return (0, pickup_guest_order_1.buildGuestOverview)(order, redemption, pickupLocation);
    }
    async guestSetOrderCustomFields(ctx, input) {
        const order = await this.loadOrder(ctx, input.orderCode);
        if (!order)
            throw new core_1.UserInputError(ERR_NOT_FOUND);
        const windowAccess = await this.configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order);
        if (!windowAccess || !(0, pickup_guest_order_1.isGuestOrder)(order)) {
            throw new core_1.UserInputError(ERR_NOT_FOUND);
        }
        await this.orderService.updateCustomFields(ctx, order.id, Object.assign({ contactPhone: input.phone }, (input.name ? { contactName: input.name } : {})));
        const refreshed = (await this.loadOrder(ctx, input.orderCode));
        await this.service.ensurePickupRedemptionForOrder(ctx, refreshed.id).catch(() => undefined);
        const redemption = await this.findRedemption(ctx, refreshed.id);
        const pickupLocation = await this.resolvePickupLocation(ctx, refreshed);
        return (0, pickup_guest_order_1.buildGuestOverview)(refreshed, redemption, pickupLocation);
    }
    /**
     * relation 类型自定义字段在 service 层未加载时只回传标量 id；
     * 从订单自定义字段配置取到 PickupLocation 实体类，按 id 解析为脱敏取货点信息。
     */
    async resolvePickupLocation(ctx, order) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const raw = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {}).selectedPickupLocationId;
        if (raw == null)
            return null;
        if (typeof raw === 'object' && raw.name != null) {
            return {
                name: String((_b = raw.name) !== null && _b !== void 0 ? _b : ''),
                address: String((_c = raw.address) !== null && _c !== void 0 ? _c : ''),
                businessHours: String((_d = raw.businessHours) !== null && _d !== void 0 ? _d : ''),
            };
        }
        const field = Array.isArray((_e = this.configService.customFields) === null || _e === void 0 ? void 0 : _e.Order)
            ? this.configService.customFields.Order.find((f) => (f === null || f === void 0 ? void 0 : f.name) === 'selectedPickupLocationId')
            : null;
        const entityCls = field === null || field === void 0 ? void 0 : field.entity;
        if (!entityCls)
            return null;
        const id = typeof raw === 'number' ? raw : Number(raw);
        if (!id)
            return null;
        const loc = await this.connection.getRepository(ctx, entityCls).findOne({ where: { id } });
        if (!loc)
            return null;
        return {
            name: String((_f = loc.name) !== null && _f !== void 0 ? _f : ''),
            address: String((_g = loc.address) !== null && _g !== void 0 ? _g : ''),
            businessHours: String((_h = loc.businessHours) !== null && _h !== void 0 ? _h : ''),
        };
    }
    async loadOrder(ctx, code) {
        const order = await this.orderService.findOneByCode(ctx, code, [
            'customer',
            'customer.user',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'fulfillments',
        ]);
        return order !== null && order !== void 0 ? order : null;
    }
    async findRedemption(ctx, orderId) {
        return this.connection
            .getRepository(ctx, pickup_redemption_entity_1.PickupRedemption)
            .findOne({ where: { orderId: orderId } });
    }
};
exports.PickupGuestOrderResolver = PickupGuestOrderResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupGuestOrderResolver.prototype, "guestOrderLookup", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickupGuestOrderResolver.prototype, "guestSetOrderCustomFields", null);
exports.PickupGuestOrderResolver = PickupGuestOrderResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.OrderService,
        core_1.ConfigService,
        core_1.TransactionalConnection,
        pickup_service_1.PickupService])
], PickupGuestOrderResolver);
//# sourceMappingURL=pickup-guest-order.resolver.js.map