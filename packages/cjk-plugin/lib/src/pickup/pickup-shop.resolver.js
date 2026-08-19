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
exports.PickupShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const pickup_location_service_1 = require("./pickup-location.service");
const i18n_messages_1 = require("./i18n-messages");
let PickupShopResolver = class PickupShopResolver {
    constructor(orderService, pickupLocationService) {
        this.orderService = orderService;
        this.pickupLocationService = pickupLocationService;
    }
    async setOrderPickupLocation(ctx, pickupLocationId, pickupType) {
        var _a, _b, _c, _d, _e, _f;
        // 支持匿名用户和登录用户
        // 匿名用户 ctx.activeUserId 为 undefined，需通过 session.activeOrderId 获取订单
        let order;
        if (ctx.activeUserId) {
            order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        }
        else if ((_a = ctx.session) === null || _a === void 0 ? void 0 : _a.activeOrderId) {
            order = (_b = await this.orderService.findOne(ctx, ctx.session.activeOrderId)) !== null && _b !== void 0 ? _b : undefined;
        }
        if (!order)
            throw new core_1.UserInputError((0, i18n_messages_1.translateError)(ctx, 'NO_ACTIVE_ORDER'));
        const location = await this.pickupLocationService.findOne(ctx, pickupLocationId);
        if (!location)
            throw new core_1.UserInputError((0, i18n_messages_1.translateError)(ctx, 'PICKUP_LOCATION_NOT_VISIBLE'));
        // 1. 写入 Order.customFields：选中的自提点、类型 + 坐标快照（就近分配锚点用）
        //    deliveryType='pickup' 是就近锚点（NearestStockLocationStrategy）与核销（confirmPickupHandover）的前置条件，
        //    必须在选点时落库，不能依赖前端回传（否则默认值 'delivery' 会让 pickup 闭环失效）。
        await this.orderService.updateCustomFields(ctx, order.id, {
            deliveryType: 'pickup',
            selectedPickupLocationId: pickupLocationId,
            pickupType,
            pickupLat: (_d = (_c = location.coordinates) === null || _c === void 0 ? void 0 : _c.lat) !== null && _d !== void 0 ? _d : null,
            pickupLng: (_f = (_e = location.coordinates) === null || _e === void 0 ? void 0 : _e.lng) !== null && _f !== void 0 ? _f : null,
        });
        // 2. 同步设置 shipping address 为自提点地址
        await this.orderService.setShippingAddress(ctx, order.id, {
            fullName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.trim() : '自提用户',
            streetLine1: location.address,
            phoneNumber: location.phoneNumber || '',
            countryCode: 'CN',
        });
        return this.orderService.findOne(ctx, order.id);
    }
};
exports.PickupShopResolver = PickupShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('pickupLocationId')),
    __param(2, (0, graphql_1.Args)('pickupType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], PickupShopResolver.prototype, "setOrderPickupLocation", null);
exports.PickupShopResolver = PickupShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_2.OrderService,
        pickup_location_service_1.PickupLocationService])
], PickupShopResolver);
//# sourceMappingURL=pickup-shop.resolver.js.map