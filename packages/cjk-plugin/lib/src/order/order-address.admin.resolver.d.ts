import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
/**
 * 改订单收货地址。
 * 注意：Vendure 自带的 setOrderShippingAddress 只在 shop-api 且只作用于活动订单，
 * 后台改已下单订单必须走这里。**不重算运费**（设计 §3 非目标）。
 *
 * Vendure 3.x 的 `Order.shippingAddress` 是 `simple-json` 列（非独立实体），
 * 因此这里做定向 update，避免整单 save 触发额外副作用。
 */
export declare class OrderAddressAdminResolver {
    private connection;
    constructor(connection: TransactionalConnection);
    updateOrderShippingAddress(ctx: RequestContext, orderId: ID, input: any): Promise<{
        id: string;
        code: string;
        shippingAddress: Record<string, any>;
    }>;
}
