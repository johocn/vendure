import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Order, OrderService, Permission, RequestContext, SessionService, UserInputError } from '@vendure/core';

/**
 * 待付款订单续付（C 端）。
 *
 * Vendure 3 的 Shop API 不暴露「切换活跃订单」能力，而 addPaymentToOrder 只作用于 session.activeOrder，
 * 导致用户「下单后未支付成功」再无入口补付。这里补一个最小 mutation：
 * 校验订单归属 + 状态可支付后，把目标订单设为当前 session 的 activeOrder，
 * 前端随后照常调用 eligiblePaymentMethods / addPaymentToOrder 完成续付。
 */
@Resolver()
export class ResumePaymentShopResolver {
    constructor(
        private sessionService: SessionService,
        private orderService: OrderService,
    ) {}

    @Mutation()
    @Allow(Permission.Owner)
    async campusResumePaymentOrder(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: string,
    ): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId);
        // 归属校验：订单必须属于当前登录客户，避免越权把他人的待付款单据设为活跃订单
        if (!order || !order.customer || !ctx.activeUserId || order.customer.user?.id !== ctx.activeUserId) {
            throw new UserInputError('ORDER_NOT_FOUND');
        }
        if (order.state !== 'ArrangingPayment') {
            throw new UserInputError('ORDER_NOT_PAYABLE');
        }
        if (!ctx.session) {
            throw new UserInputError('SESSION_REQUIRED');
        }
        await this.sessionService.setActiveOrder(ctx, ctx.session, order);
        return order;
    }
}
