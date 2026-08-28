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
exports.OrderSplitShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const order_split_service_1 = require("./order-split.service");
/**
 * 拆单结算入口。用户选择非余额支付方式且聚合需拆多单时调用。
 * 返回的是「已各自结算」的订单列表（方法内部逐单 addPaymentToOrder）。
 * path A（余额）或无需拆单时前端仍走既有单订单 addPaymentToOrder，不应调用本 mutation。
 */
let OrderSplitShopResolver = class OrderSplitShopResolver {
    constructor(orderService, orderSplitService) {
        this.orderService = orderService;
        this.orderSplitService = orderSplitService;
    }
    async resolveActiveOrder(ctx) {
        var _a;
        let order;
        if (ctx.activeUserId) {
            order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        }
        else if ((_a = ctx.session) === null || _a === void 0 ? void 0 : _a.activeOrderId) {
            order = (await this.orderService.findOne(ctx, ctx.session.activeOrderId));
        }
        if (!order)
            throw new core_1.UserInputError('NO_ACTIVE_ORDER');
        return order;
    }
    async checkoutSplitted(ctx, method, metadata) {
        const order = await this.resolveActiveOrder(ctx);
        const parsedMetadata = metadata ? this.parseMetadata(metadata) : undefined;
        return this.orderSplitService.performSplitCheckout(ctx, order, method, parsedMetadata);
    }
    parseMetadata(raw) {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : undefined;
        }
        catch (_a) {
            return undefined;
        }
    }
};
exports.OrderSplitShopResolver = OrderSplitShopResolver;
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('method')),
    __param(2, (0, graphql_1.Args)('metadata', { nullable: true, type: () => String })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], OrderSplitShopResolver.prototype, "checkoutSplitted", null);
exports.OrderSplitShopResolver = OrderSplitShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_2.OrderService,
        order_split_service_1.OrderSplitService])
], OrderSplitShopResolver);
//# sourceMappingURL=order-split-shop.resolver.js.map