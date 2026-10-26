import { DeepPartial, VendureEntity } from '@vendure/core';
import { BillPayStatus } from './types';
/**
 * 代买单委托单：独立单据，不生成 Vendure Order（不进既有订单列表/流程）。
 * 参照 coupon_sale_order 骨架扩展（设计文档 §2.1）。金额单位：分。
 */
export declare class BillPayOrder extends VendureEntity {
    constructor(input?: DeepPartial<BillPayOrder>);
    /** 业务单号 BP-<id>，全局唯一（亦作微信 out_trade_no，回调按 BP- 前缀路由） */
    code: string | null;
    /** 下单客户 */
    customerId: number;
    /** 商家名称（P0 文本 + 历史联想） */
    merchantName: string;
    /** 预计账单金额 */
    expectedAmount: number;
    /** 平台报价 = 客户应付 */
    quoteAmount: number | null;
    /** 管家实际代付金额（凭证回传时填写，商家账单原价口径） */
    actualAmount: number | null;
    /** 优惠明细 JSON：[{rule, label, amount}] */
    discountDetail: string | null;
    /** 下单抵扣所用券码（null = 未用券）；与 couponDiscount 成对落库，便于对账追溯 */
    couponCode: string | null;
    /** 券实际抵扣额（分）；明细仍在 discountDetail，单独成列便于统计 */
    couponDiscount: number | null;
    status: BillPayStatus;
    /** 客户备注（留言卡/包间等） */
    remark: string | null;
    /** 管家报价说明（人工改价时必填） */
    quoteNote: string | null;
    /** 报价有效期（超时惰性失效回 PENDING_QUOTE） */
    quoteExpireAt: Date | null;
    /** 代付凭证（支付截图/小票 URL，受控访问） */
    proofUrl: string | null;
    /** 外部支付单号 out_trade_no（= code，幂等核对） */
    payRef: string | null;
    /** wechatpay | balance */
    paymentMethod: string | null;
    /** 接单管家/操作人（web-admin 用户 id） */
    operatorId: number | null;
    /** 结算台账行引用（bill_pay_settlement.id） */
    settleLedgerId: number | null;
    paidAt: Date | null;
    completedAt: Date | null;
    settledAt: Date | null;
    refundedAt: Date | null;
    /** 超容忍阈值时的备注说明 */
    completeNote: string | null;
    channelId: number;
}
