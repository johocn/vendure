import { Customer, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
export interface OrderSelection {
    productId: string;
    quantity: number;
}
/** 下单落单收货地址（对话选址携带，含电话） */
export interface OrderShippingAddress {
    fullName?: string;
    phoneNumber?: string;
    streetLine1: string;
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
/** 对话内展示的支付方式（渠道启用 + 后台配置展示名） */
export interface PaymentMethodOption {
    code: string;
    name: string;
}
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
    createOrder(ctx: RequestContext, customer: Customer, selections: OrderSelection[], address?: OrderShippingAddress): Promise<CreateOrderOutcome>;
    /**
     * 渠道当前启用的支付方式（按后台展示名去重，最多 8 个）。
     * 展示名取当前语言 → en → 首个翻译；未配置翻译时回退 code。
     */
    listPaymentMethods(ctx: RequestContext): Promise<PaymentMethodOption[]>;
    /** 支付方式展示名（当前语言 → en → 首个翻译） */
    private paymentMethodName;
    /**
     * 渠道默认变体：商品已发布 → 取该渠道有价格且启用、按价格升序的第一个变体。
     * 查询限定 channelId 匹配价格行，避免跨渠道下单。
     */
    private resolveDefaultVariant;
}
