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
exports.OrderBoxShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const order_box_service_1 = require("./order-box.service");
const i18n_messages_1 = require("../pickup/i18n-messages");
let OrderBoxShopResolver = class OrderBoxShopResolver {
    constructor(orderService, orderBoxService) {
        this.orderService = orderService;
        this.orderBoxService = orderBoxService;
    }
    /** 解析当前活动订单（兼容匿名与登录用户，同 PickupShopResolver 模式） */
    async resolveActiveOrder(ctx) {
        var _a, _b;
        let order;
        if (ctx.activeUserId) {
            order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        }
        else if ((_a = ctx.session) === null || _a === void 0 ? void 0 : _a.activeOrderId) {
            order = (_b = (await this.orderService.findOne(ctx, ctx.session.activeOrderId))) !== null && _b !== void 0 ? _b : undefined;
        }
        if (!order)
            throw new core_1.UserInputError((0, i18n_messages_1.translateError)(ctx, 'NO_ACTIVE_ORDER'));
        return order;
    }
    /**
     * 返回当前订单的分箱结果，供前端「按箱展示配送」使用。
     * 每箱含：生效配送档案、落入 lineIds、可用配送方式、可用自提点，
     * 以及（新增）每箱行明细 lines、可用优惠券、配送费/免邮折扣、箱小计、租户名。
     * 通过关系装载补充 shippingLines / customer / productVariant.product（供按箱金额与券范围判定）。
     */
    async orderBoxes(ctx) {
        const order = await this.resolveActiveOrder(ctx);
        const loaded = await this.orderService.findOne(ctx, order.id, [
            'channels',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'shippingLines',
            'customer',
        ]);
        return this.orderBoxService.computeOrderBoxes(ctx, (loaded !== null && loaded !== void 0 ? loaded : order));
    }
    /**
     * 返回当前订单按租户（商户）拆分的结算金额（各箱 subtotal 之和）。
     * 新增 Top-level Query，不改动 orderBoxes 现有结构。
     */
    async orderMerchantSplit(ctx) {
        const order = await this.resolveActiveOrder(ctx);
        const loaded = await this.orderService.findOne(ctx, order.id, [
            'channels',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'shippingLines',
            'customer',
        ]);
        return this.orderBoxService.computeMerchantSplit(ctx, (loaded !== null && loaded !== void 0 ? loaded : order));
    }
    /**
     * 为某一箱设置配送方式（自提类可同时传 pickupLocationId）。
     * 将该箱 lines 关联到对应 ShippingLine；所有箱一起核心结算，前端按箱各调一次。
     */
    async setOrderBoxShippingMethod(ctx, boxKey, shippingMethodId, pickupLocationId) {
        const order = await this.resolveActiveOrder(ctx);
        return this.orderBoxService.setBoxShippingMethod(ctx, order, boxKey, shippingMethodId, pickupLocationId);
    }
};
exports.OrderBoxShopResolver = OrderBoxShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], OrderBoxShopResolver.prototype, "orderBoxes", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], OrderBoxShopResolver.prototype, "orderMerchantSplit", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('boxKey')),
    __param(2, (0, graphql_1.Args)('shippingMethodId')),
    __param(3, (0, graphql_1.Args)('pickupLocationId', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object, Object]),
    __metadata("design:returntype", Promise)
], OrderBoxShopResolver.prototype, "setOrderBoxShippingMethod", null);
exports.OrderBoxShopResolver = OrderBoxShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_2.OrderService,
        order_box_service_1.OrderBoxService])
], OrderBoxShopResolver);
//# sourceMappingURL=order-box-shop.resolver.js.map