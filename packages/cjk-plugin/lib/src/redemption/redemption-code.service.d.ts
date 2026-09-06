import { ID, RequestContext, OrderService, TransactionalConnection, Order } from '@vendure/core';
import { RedemptionStatus } from './redemption-crypto';
/** 到店/货到付款（COD）支付方式 code，命中即需收银确认；与 nshop 确认页 & 旧 pickup 收银一致 */
export declare const COD_PAYMENT_CODES: string[];
export interface PendingRedemptionItem {
    orderId: string;
    orderCode: string;
    code: string;
    status: string;
    expiresAt: string | null;
    version: number;
    claimed: boolean;
    paymentType: string | null;
    collected: boolean;
}
export interface ClaimResult {
    already: boolean;
    claimedAt: Date | null;
    collected: boolean;
    collectRequired: boolean;
}
export type CollectMode = 'optional' | 'force';
export declare class RedemptionCodeService {
    private orderService;
    private connection;
    private readonly keyHex;
    private readonly graceDays;
    private readonly expireRemindHours;
    constructor(orderService: OrderService, connection: TransactionalConnection);
    private cf;
    private isCodOrder;
    /**
     * 到店/货到付款收款确认模式：Channel 自定义字段 redeemCollectMode（force/optional）优先，
     * 未配置时回退环境变量 REDEMPTION_COLLECT_MODE=force，默认 optional（只高亮不强制）。
     */
    collectMode(ctx: RequestContext): CollectMode;
    /** COD 收款后把该订单的分账台账 PENDING_SIGN → PAID（在线支付结算时即 PAID，无需翻转） */
    private flipLedgerToPaid;
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
        collected: boolean;
        isCod: boolean;
        paymentType: string | null;
    }>;
    /**
     * 租户域：本渠道「待核销自提单」列表（含已过期；claimed 者不列出）。
     * 仅 deliveryType=pickup 的订单（cjk 对所有 ArrangingPayment 单生成码，故必须按自提筛选）。
     * Order 按 channelId 归属多租户隔离；码密文解密后回填 code，状态由 computeRedemptionStatus 推导。
     */
    listPending(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }): Promise<{
        items: PendingRedemptionItem[];
        totalItems: number;
    }>;
    /**
     * 管理端按输入码定位（限当前租户 Channel）。返回订单指针或 null。
     * Order 是 ChannelAware（ManyToMany order.channels），按 channelId 归属多租户隔离。
     * redeemCodeHash 存于 Order.customFields jsonb 列，用 jsonb 字段提取（同 sales-plugin 写法）。
     */
    lookupByCode(ctx: RequestContext, inputCode: string): Promise<Order | null>;
    /**
     * 到店/货到付款（COD）单核销收款闭环：
     *  - 非 COD 直接核销；
     *  - COD 且未收款：force 模式必须传 collect=true 才放行，否则返回 collectRequired（阻止核销）；
     *    optional 模式允许不收款核销（前端高亮待收款），传 collect=true 时同步确认收款。
     *  - 确认收款后写 order.customFields.collected，并把分账台账 PENDING_SIGN → PAID。
     */
    claim(ctx: RequestContext, orderId: ID, collect?: boolean): Promise<ClaimResult>;
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
