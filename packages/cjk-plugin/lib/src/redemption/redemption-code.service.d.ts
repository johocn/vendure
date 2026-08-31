import { ID, RequestContext, OrderService, TransactionalConnection, Order } from '@vendure/core';
export declare class RedemptionCodeService {
    private orderService;
    private connection;
    private readonly keyHex;
    constructor(orderService: OrderService, connection: TransactionalConnection);
    private cf;
    /**
     * 幂等确保订单已生成核销码。返回解密的明文核销码。
     */
    ensure(ctx: RequestContext, orderId: ID): Promise<string>;
    getWithQr(ctx: RequestContext, orderId: ID, orderCode: string): Promise<{
        code: string;
        qrPayload: string;
        barcode: string;
        claimed: boolean;
    }>;
    /**
     * 管理端按输入码定位（限当前租户 Channel）。返回订单指针或 null。
     * Order 是 ChannelAware（ManyToMany order.channels），按 channelId 归属多租户隔离。
     * redeemCodeHash 存于 Order.customFields jsonb 列，用 jsonb 字段提取（同 sales-plugin 写法）。
     */
    lookupByCode(ctx: RequestContext, inputCode: string): Promise<Order | null>;
    claim(ctx: RequestContext, orderId: ID): Promise<{
        already: boolean;
        claimedAt: Date;
    }>;
}
