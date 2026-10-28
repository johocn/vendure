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
exports.ResumePaymentShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
/**
 * 待付款订单续付（C 端）。
 *
 * Vendure 3 的 Shop API 不暴露「切换活跃订单」能力，而 addPaymentToOrder 只作用于 session.activeOrder，
 * 导致用户「下单后未支付成功」再无入口补付。这里补一个最小 mutation：
 * 校验订单归属 + 状态可支付后，把目标订单设为当前 session 的 activeOrder，
 * 前端随后照常调用 eligiblePaymentMethods / addPaymentToOrder 完成续付。
 */
let ResumePaymentShopResolver = class ResumePaymentShopResolver {
    constructor(sessionService, orderService) {
        this.sessionService = sessionService;
        this.orderService = orderService;
    }
    async campusResumePaymentOrder(ctx, orderId) {
        var _a;
        const order = await this.orderService.findOne(ctx, orderId);
        // 归属校验：订单必须属于当前登录客户，避免越权把他人的待付款单据设为活跃订单
        if (!order || !order.customer || !ctx.activeUserId || ((_a = order.customer.user) === null || _a === void 0 ? void 0 : _a.id) !== ctx.activeUserId) {
            throw new core_1.UserInputError('ORDER_NOT_FOUND');
        }
        if (order.state !== 'ArrangingPayment') {
            throw new core_1.UserInputError('ORDER_NOT_PAYABLE');
        }
        if (!ctx.session) {
            throw new core_1.UserInputError('SESSION_REQUIRED');
        }
        await this.sessionService.setActiveOrder(ctx, ctx.session, order);
        return order;
    }
};
exports.ResumePaymentShopResolver = ResumePaymentShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], ResumePaymentShopResolver.prototype, "campusResumePaymentOrder", null);
exports.ResumePaymentShopResolver = ResumePaymentShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.SessionService,
        core_1.OrderService])
], ResumePaymentShopResolver);
//# sourceMappingURL=resume-payment-shop.resolver.js.map