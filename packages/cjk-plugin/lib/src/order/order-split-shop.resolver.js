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
 * 拆单结算入口（统一结算）。内部按所选支付方式聚合拆合并逐单结算：
 * - 选余额 → 全部箱并入 1 单（Path A，一次余额扣款）；
 * - 选非余额且各箱可选方式交集含所选方式 → 并入 1 单（台账另行分账）；
 * - 选非余额且不在交集 → 一律按箱全拆，每配送档案一单。
 * boxKeys/lineIds 可选：限定只结算部分箱 / 箱内部分行；未传则结算全部箱与行，
 * 未选中的行「回流购物车」留在源活动订单。
 * 返回「已各自结算」的订单列表（方法内部逐单 addPaymentToOrder）。
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
    async checkoutSplitted(ctx, method, metadata, boxKeys, lineIds) {
        const order = await this.resolveActiveOrder(ctx);
        const parsedMetadata = metadata ? this.parseMetadata(metadata) : undefined;
        const opts = {};
        if (boxKeys)
            opts.boxKeys = boxKeys;
        if (lineIds)
            opts.lineIds = lineIds;
        return this.orderSplitService.performSplitCheckout(ctx, order, method, parsedMetadata, opts);
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
    __param(3, (0, graphql_1.Args)('boxKeys', { type: () => [String] })),
    __param(4, (0, graphql_1.Args)('lineIds', { type: () => [String] })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, Array, Array]),
    __metadata("design:returntype", Promise)
], OrderSplitShopResolver.prototype, "checkoutSplitted", null);
exports.OrderSplitShopResolver = OrderSplitShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_2.OrderService,
        order_split_service_1.OrderSplitService])
], OrderSplitShopResolver);
//# sourceMappingURL=order-split-shop.resolver.js.map