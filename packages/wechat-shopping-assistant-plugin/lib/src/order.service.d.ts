import { Customer, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
export interface OrderSelection {
    productId: string;
    quantity: number;
}
export type CreateOrderOutcome = {
    status: 'ok';
    order: Order;
    items: Array<{
        title: string;
        quantity: number;
        price: number;
    }>;
} | {
    status: 'out_of_stock';
    title: string;
} | {
    status: 'no_variant';
    title: string;
} | {
    status: 'error';
    message: string;
};
/**
 * 微信对话下单：
 * 选品（productId）→ 解析渠道默认变体（最低价有货）→ 建 Order 绑顾客 → 加购物车 → ArrangingPayment。
 * 绑顾客走 orderService.addCustomerToOrder（同步更新内存实体，ArrangingPayment 的
 * customer 守卫可见；裸 repo update 只落库、守卫读不到）。支付通过返回的订单号跳 H5 收银台。
 */
export declare class AssistantOrderService {
    private connection;
    private orderService;
    constructor(connection: TransactionalConnection, orderService: OrderService);
    createOrder(ctx: RequestContext, customer: Customer, selections: OrderSelection[]): Promise<CreateOrderOutcome>;
    /**
     * 渠道默认变体：商品已发布 → 取该渠道有价格且启用、按价格升序的第一个变体。
     * 查询限定 channelId 匹配价格行，避免跨渠道下单。
     */
    private resolveDefaultVariant;
}
