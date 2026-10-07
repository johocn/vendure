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
exports.MyOrdersShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const loggerCtx = 'MyOrdersShopResolver';
/** 顾客可自行取消的订单状态（尚未支付/未进入履约） */
const CUSTOMER_CANCELLABLE_STATES = ['Created', 'AddingItems', 'ArrangingPayment'];
/**
 * C 端「我的订单」列表查询。
 *
 * 前端 `vshop/src/api/queries/order.ts#getOrders` 一直在发
 * `myOrders(options: OrderListOptions): OrderList!`，但生产 shop-api 上从未注册过该字段，
 * 导致「我的订单」页恒空。此处补齐字段并用当前登录用户反查 customer，严格按顾客隔离，
 * 拿不到顾客即返回空列表（绝不返回全站订单，防串号）。
 *
 * 排除 Draft（草稿单）与 AddingItems（顾客正在编辑的购物车单），
 * 保留 ArrangingPayment 及之后所有已下单状态。
 *
 * 关系不用手写列表，而是走 core 的 `@Relations(Order)` 装饰器：它按本次 GraphQL 查询的
 * 选择集推导所需关系，并带上 `@Calculated()` 属性（taxSummary / discounts / totalQuantity）
 * 声明的关系依赖。手写列表一旦漏项（如漏 `surcharges`）就会整条查询报
 * 「property "taxSummary" ... requires the Order.surcharges relation to be joined」，
 * 前端只会表现为「暂无订单」，难以定位。
 */
let MyOrdersShopResolver = class MyOrdersShopResolver {
    constructor(customerService, listQueryBuilder, orderService, stockMovementService) {
        this.customerService = customerService;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = orderService;
        this.stockMovementService = stockMovementService;
    }
    async myOrders(ctx, options, relations) {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            return { items: [], totalItems: 0 };
        }
        const effectiveOptions = options !== null && options !== void 0 ? options : { take: 10, sort: { createdAt: 'DESC' } };
        return this.listQueryBuilder
            .build(core_1.Order, effectiveOptions, { ctx, channelId: ctx.channelId, relations })
            .andWhere('order.customer.id = :customerId', { customerId: customer.id })
            .andWhere('order.state NOT IN (:...excludedStates)', {
            excludedStates: ['Draft', 'AddingItems'],
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    /**
     * C 端「取消订单」：仅限本人、且处于未支付/未履约状态（Created/AddingItems/ArrangingPayment）。
     * core 的 cancelOrder 对 active 订单（如 ArrangingPayment）不会释放库存分配，
     * 需先显式释放分配，否则取消后库存被永久占用（与 order-timeout-plugin 同一处理）。
     */
    async cancelMyOrder(ctx, orderId) {
        var _a, _b, _c;
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user', 'lines']);
        if (!order) {
            throw new core_1.EntityNotFoundError('Order', orderId);
        }
        // 归属校验：order.customer.id 是 Customer 主键，与 activeUserId（User 主键）不同，须比 customer.user.id
        const customerUserId = (_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
            throw new core_1.ForbiddenError();
        }
        if (!CUSTOMER_CANCELLABLE_STATES.includes(order.state)) {
            throw new core_1.UserInputError(`ORDER_CANNOT_BE_CANCELLED:${order.state}`);
        }
        const lines = ((_c = order.lines) !== null && _c !== void 0 ? _c : []).map(l => ({ orderLineId: l.id, quantity: l.quantity }));
        if (lines.length > 0) {
            await this.stockMovementService.createReleasesForOrderLines(ctx, lines);
        }
        const result = await this.orderService.cancelOrder(ctx, { orderId });
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            core_1.Logger.warn(`取消订单失败 order#${orderId}: ${result.message}`, loggerCtx);
            throw new core_1.UserInputError(result.message);
        }
        return result;
    }
};
exports.MyOrdersShopResolver = MyOrdersShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __param(2, (0, core_1.Relations)(core_1.Order)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], MyOrdersShopResolver.prototype, "myOrders", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MyOrdersShopResolver.prototype, "cancelMyOrder", null);
exports.MyOrdersShopResolver = MyOrdersShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.CustomerService,
        core_1.ListQueryBuilder,
        core_1.OrderService,
        core_1.StockMovementService])
], MyOrdersShopResolver);
//# sourceMappingURL=my-orders-shop.resolver.js.map