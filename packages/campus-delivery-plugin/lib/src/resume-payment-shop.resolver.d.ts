import { Order, OrderService, RequestContext, SessionService } from '@vendure/core';
/**
 * 待付款订单续付（C 端）。
 *
 * Vendure 3 的 Shop API 不暴露「切换活跃订单」能力，而 addPaymentToOrder 只作用于 session.activeOrder，
 * 导致用户「下单后未支付成功」再无入口补付。这里补一个最小 mutation：
 * 校验订单归属 + 状态可支付后，把目标订单设为当前 session 的 activeOrder，
 * 前端随后照常调用 eligiblePaymentMethods / addPaymentToOrder 完成续付。
 */
export declare class ResumePaymentShopResolver {
    private sessionService;
    private orderService;
    constructor(sessionService: SessionService, orderService: OrderService);
    campusResumePaymentOrder(ctx: RequestContext, orderId: string): Promise<Order>;
}
