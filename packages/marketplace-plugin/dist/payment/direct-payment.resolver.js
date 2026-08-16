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
exports.DirectPaymentResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
let DirectPaymentResolver = class DirectPaymentResolver {
    constructor(orderService, customerService) {
        this.orderService = orderService;
        this.customerService = customerService;
    }
    async payMarketplaceSellerOrder(ctx, args) {
        var _a;
        if (!ctx.activeUserId) {
            return { errorCode: 'NO_ACTIVE_ORDER', message: '未登录' };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId, false);
        if (!customer) {
            return { errorCode: 'NO_ACTIVE_ORDER', message: '未找到顾客' };
        }
        const order = await this.orderService.findOne(ctx, args.orderId, ['customer', 'channels']);
        if (!order) {
            throw new core_1.EntityNotFoundError('Order', args.orderId);
        }
        // 校验订单归属当前顾客
        if (!order.customer || order.customer.id !== customer.id) {
            throw new core_1.EntityNotFoundError('Order', args.orderId);
        }
        // 仅允许 marketplace 商家子单通过此入口支付
        if (order.customFields.saleSource !== constants_1.SALE_SOURCE_MARKETPLACE) {
            return { errorCode: 'ORDER_PAYMENT_STATE', message: '非 marketplace 商家子单，不可在此支付' };
        }
        const result = await this.orderService.addPaymentToOrder(ctx, order.id, {
            method: args.method,
            metadata: (_a = args.metadata) !== null && _a !== void 0 ? _a : {},
        });
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            return result;
        }
        return result;
    }
};
exports.DirectPaymentResolver = DirectPaymentResolver;
__decorate([
    (0, graphql_1.Mutation)('payMarketplaceSellerOrder'),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DirectPaymentResolver.prototype, "payMarketplaceSellerOrder", null);
exports.DirectPaymentResolver = DirectPaymentResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.OrderService,
        core_1.CustomerService])
], DirectPaymentResolver);
