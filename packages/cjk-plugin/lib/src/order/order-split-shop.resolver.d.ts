import { Order, RequestContext } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { OrderSplitService } from './order-split.service';
/**
 * 拆单结算入口。用户选择非余额支付方式且聚合需拆多单时调用。
 * 返回的是「已各自结算」的订单列表（方法内部逐单 addPaymentToOrder）。
 * path A（余额）或无需拆单时前端仍走既有单订单 addPaymentToOrder，不应调用本 mutation。
 */
export declare class OrderSplitShopResolver {
    private orderService;
    private orderSplitService;
    constructor(orderService: OrderService, orderSplitService: OrderSplitService);
    private resolveActiveOrder;
    checkoutSplitted(ctx: RequestContext, method: string, metadata?: string): Promise<Order[]>;
    private parseMetadata;
}
