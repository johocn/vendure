import { ChannelService, CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { WechatpayService } from '@vendure/wechatpay-plugin';
import { BillPayOrder } from './bill-pay-order.entity';
import { MerchantAgreement } from './merchant-agreement.entity';
import { BillPayChannelConfig, BillPayStatus } from './types';
export declare function setBillPayGateway(gw: WechatpayService | null): void;
/**
 * 代买单编排服务：委托单状态机（设计文档 §3）+ 支付链路（§5）+ 台账结算（§10）。
 * 所有金额单位为「分」；单据不生成 Vendure Order，渠道隔离一律按 ctx.channelId。
 */
export declare class BillPayService {
    private connection;
    private customerService;
    private channelService;
    constructor(connection: TransactionalConnection, customerService: CustomerService, channelService: ChannelService);
    private currentCustomerId;
    /** 渠道配置：bill_pay_config JSON → 解析（坏配置逐字段回退默认） */
    getChannelConfig(ctx: RequestContext): Promise<BillPayChannelConfig>;
    /** 实体 → GraphQL 形态（discountDetail JSON 反序列化） */
    toGraph(order: BillPayOrder): any;
    private orderRepo;
    /** 惰性报价过期：QUOTED 超期 → 回 PENDING_QUOTE（读路径收敛，不依赖定时器） */
    private normalizeQuoteExpiry;
    private loadChannelOrder;
    private loadOwnedOrder;
    private applyQuoteFields;
    /**
     * 客户提交委托：限额校验（单笔 min + 单日累计）→ PENDING_QUOTE，autoQuote 命中即同步报价转 QUOTED
     * 商户关联：优先 merchantId，缺省按名称/编码解析；merchant-plugin 未装载时退回纯名称模式。
     */
    createBillPayOrder(ctx: RequestContext, input: {
        merchantName: string;
        merchantId?: ID | null;
        expectedAmount: number;
        remark?: string | null;
        couponCode?: string | null;
    }): Promise<BillPayOrder>;
    /** 客户自助取消：仅 PENDING_QUOTE / QUOTED */
    cancelBillPayOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder>;
    /** 我的委托单 */
    myBillPayOrders(ctx: RequestContext, statuses?: BillPayStatus[]): Promise<BillPayOrder[]>;
    findOwnedBillPayOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder>;
    /** 生成微信支付参数（仅本人 QUOTED 未超期单），镜像 coupon-sale 的 CS- 范式，单号前缀 BP- */
    createWechatBillPayment(ctx: RequestContext, id: ID, tradeType?: 'JSAPI' | 'NATIVE' | 'H5' | 'APP', openid?: string): Promise<any>;
    /** 微信回调结算入口：解析 BP-<id>，原子置 QUOTED → PAID（幂等，参照 coupon-sale L208-237） */
    settleBillPayOrderByOutTradeNo(ctx: RequestContext, outTradeNo: string): Promise<void>;
    /** 账单支付单所属渠道的 admin ctx（回调 ctx 的渠道可能与之不同） */
    private orderChannelCtx;
    /** 余额支付（同步结算）：先置 PAID 再扣余额（扣款内部提交事务，顺序对齐 coupon-sale L152-170） */
    payBillPayOrderWithBalance(ctx: RequestContext, id: ID): Promise<BillPayOrder>;
    /**
     * 支付成功 → 核销券（幂等：仅 UNUSED/RETURNED 可置 USED），并补写券核销流水。
     * 券已被他单使用/查不到属数据异常，支付已不可逆，故只记 error 不抛错。
     */
    private redeemCoupon;
    /**
     * 写券核销流水（coupon_redemption），供门店/平台对账口径统一。
     * - 买单无门店维度：storeId 记 0（0 即「非门店核销」，可按 0 区分统计）；
     * - merchantId 取订单商户快照，核销金额取本单券抵扣额（分）；
     * - 用 rawConnection 的独立仓库写入，避免流水写失败把已到账的支付事务拖入回滚；
     * - 按「每次核销」落流水，不按券查重：退款将券回退为 RETURNED 后可再次核销，
     *   同券多次核销需各记一条；幂等由 redeemCoupon 的 USED 原子置位（每次支付仅一次核销）保证。
     */
    private recordCouponRedemption;
    /**
     * 取消 → 释放券：只回退本单预占（reservedOrderId）或本单已核销（usedOrderId）的券，
     * 防止误释放已被其它委托单使用的券。
     */
    private releaseCoupon;
    /** 人工改价：PENDING_QUOTE → QUOTED，note 必填 */
    updateBillPayQuote(ctx: RequestContext, id: ID, quoteAmount: number, note: string): Promise<BillPayOrder>;
    /** 接单：PAID → IN_SERVICE，记录操作人；此后取消/退款仅人工入口 */
    acceptBillPayOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder>;
    /** 凭证回传：IN_SERVICE → COMPLETED；超容忍阈值（|actual-quote|/quote > tolerancePercent）需备注 */
    completeBillPayOrder(ctx: RequestContext, id: ID, actualAmount: number, proofUrl: string, note?: string | null): Promise<BillPayOrder>;
    /** 结算：COMPLETED → SETTLED，写 bill_pay_settlement 台账（差价模型毛利） */
    settleBillPayOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder>;
    /** 人工退款：仅 PAID 未接单；微信原路退 / 余额退回（IN_SERVICE 后仅走对账人工处理） */
    refundBillPayOrder(ctx: RequestContext, id: ID, reason?: string): Promise<BillPayOrder>;
    /**
     * 退款退券：本单已核销的券 USED → RETURNED，清 usedOrderId/usedAt（券恢复可用直至过期）。
     * 与 coupon-plugin returnCoupon 一致：核销流水保留、不写 revokedAt；
     * 条件带 usedOrderId=本单，防止误退已被其它单核销的券，且天然幂等。
     */
    private returnCouponOnRefund;
    /** 工作台列表：状态 tab；渠道隔离（超管渠道 1 看全量，对齐 merchantSettlementAdminResolver 口径） */
    adminList(ctx: RequestContext, opts: {
        skip?: number;
        take?: number;
        status?: BillPayStatus;
    }): Promise<{
        items: BillPayOrder[];
        totalItems: number;
    }>;
    adminFind(ctx: RequestContext, id: ID): Promise<BillPayOrder>;
    listAgreements(ctx: RequestContext): Promise<MerchantAgreement[]>;
    /** 商家协议 upsert：渠道内按商家名唯一；能解析到商户时同时落 merchantId */
    saveAgreement(ctx: RequestContext, input: {
        merchantName: string;
        merchantId?: ID | null;
        settleRate: number;
        settleMode?: string;
        contact?: string | null;
        note?: string | null;
    }, id?: ID): Promise<MerchantAgreement>;
    /**
     * 商户租户归属校验：商户至少有一家未删除门店被当前渠道 ACTIVE 认领。
     * merchant-plugin 未装载（无 merchant_store_channel 表）时跳过，退回纯名称模式。
     */
    private assertMerchantClaimed;
    /**
     * 解析商户关联：优先 merchantId，缺省按名称/编码精确匹配未删除商户。
     * - merchant 表不存在（未装载 merchant-plugin）→ 返回 null，调用方退回纯名称模式；
     * - merchantId 显式传入但不存在/已删除 → 直接报错；
     * - required=false 时名称解析不到返回 null（协议允许先建后补主数据）。
     */
    private resolveMerchant;
    getRawChannelConfig(ctx: RequestContext): Promise<BillPayChannelConfig>;
    saveChannelConfig(ctx: RequestContext, config: unknown): Promise<BillPayChannelConfig>;
}
