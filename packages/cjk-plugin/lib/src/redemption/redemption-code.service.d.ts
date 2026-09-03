import { ID, RequestContext, OrderService, TransactionalConnection, Order } from '@vendure/core';
import { RedemptionStatus } from './redemption-crypto';
export declare class RedemptionCodeService {
    private orderService;
    private connection;
    private readonly keyHex;
    private readonly graceDays;
    private readonly expireRemindHours;
    constructor(orderService: OrderService, connection: TransactionalConnection);
    private cf;
    private writeExpiry;
    /**
     * 幂等确保订单已生成核销码。返回解密的明文核销码。
     */
    ensure(ctx: RequestContext, orderId: ID): Promise<string>;
    getWithQr(ctx: RequestContext, orderId: ID, orderCode: string): Promise<{
        code: string;
        qrPayload: string;
        barcode: string;
        claimed: boolean;
        status: RedemptionStatus;
        expiresAt: string | null;
        version: number;
        reissueable: boolean;
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
    /**
     * 作废重发：已核销单禁止重发（一次性闭环）。新码重算密文/指纹并覆盖 → lookupByCode 命中激活码，旧码自然失效。
     */
    reissue(ctx: RequestContext, orderId: ID): Promise<{
        code: string;
        qrPayload: string;
        barcode: string;
        claimed: boolean;
        status: RedemptionStatus;
        expiresAt: string;
        version: number;
        reissueable: boolean;
    }>;
}
