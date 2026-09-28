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
exports.OrderPriceAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
/** 允许改价的订单状态：草稿单（Modifying）与尚未结算的活动订单 */
const ADJUSTABLE_STATES = ['Modifying', 'AddingItems', 'ArrangingPayment'];
/**
 * 后台改价（F-WA-08）。
 *
 * 原前端直接调 core 的 `modifyOrder` 且传 `surcharges: [{ priceDelta }]`：
 * ① `priceDelta` 并非 `SurchargeInput` 字段 → 请求本身就被 GraphQL 校验拒绝；
 * ② 即使改成 `price`，core 的 `modifyOrder` 要求订单处于 `Modifying` 态，且降价时
 *    必须有 `refunds`（草稿单无支付记录可退）→ `RefundPaymentIdMissingError`；
 * ③ 改价幅度无服务端上限。
 *
 * 这里统一走 `OrderService.addSurchargeToOrder`（对订单状态无限制，支持带符号 surcharge，
 * 负价即降价），并在服务端强校验差额与渠道上限。
 */
let OrderPriceAdminResolver = class OrderPriceAdminResolver {
    constructor(orderService) {
        this.orderService = orderService;
    }
    async adjustOrderPrice(ctx, args) {
        var _a, _b;
        const { orderId, amount, note } = args.input;
        // 差额单位：分；必须为非零整数（正数加价，负数降价）
        if (!Number.isInteger(amount) || amount === 0) {
            throw new core_1.UserInputError('改价差额必须为非零整数（单位：分）');
        }
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new core_1.UserInputError(`订单 ${orderId} 不存在`);
        }
        if (!ADJUSTABLE_STATES.includes(order.state)) {
            throw new core_1.UserInputError(`订单当前状态「${order.state}」不支持改价`);
        }
        // 渠道级上限：总额比例与绝对额取小
        const cf = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {};
        const rateBp = Number.isFinite(cf.orderAdjustMaxRateBp) ? Number(cf.orderAdjustMaxRateBp) : 2000;
        const maxAmount = Number.isFinite(cf.orderAdjustMaxAmount) ? Number(cf.orderAdjustMaxAmount) : 500000;
        const limit = Math.min(Math.floor((order.totalWithTax * rateBp) / 10000), maxAmount);
        if (Math.abs(amount) > limit) {
            throw new core_1.UserInputError(`改价幅度超出上限（最多 ${(limit / 100).toFixed(2)} 元）`);
        }
        if (order.totalWithTax + amount < 0) {
            throw new core_1.UserInputError('改价后订单总额不能为负数');
        }
        return this.orderService.addSurchargeToOrder(ctx, orderId, {
            description: (note || '后台改价').slice(0, 255),
            sku: '',
            listPrice: amount,
            listPriceIncludesTax: ctx.channel.pricesIncludeTax,
            taxLines: [],
        });
    }
};
exports.OrderPriceAdminResolver = OrderPriceAdminResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], OrderPriceAdminResolver.prototype, "adjustOrderPrice", null);
exports.OrderPriceAdminResolver = OrderPriceAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.OrderService])
], OrderPriceAdminResolver);
//# sourceMappingURL=order-price-admin.resolver.js.map