import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 代买单结算台账（设计文档 §3 SETTLED / §10）。
 *
 * 独立于 cjk-plugin 的 merchant_settlement_ledger：该表消费方不按类型过滤且 orderId 与
 * Vendure Order 共用数字 id 会冲突（§15 护栏「先确认所有 ledger 消费方按类型过滤汇总」
 * 前提不成立），故按纯增量原则自建台账表，月度对账/报表从本表出。
 * 金额单位：分。毛利 = quoteAmount − costAmount（差价模型）。
 */
export declare class BillPaySettlement extends VendureEntity {
    constructor(input?: DeepPartial<BillPaySettlement>);
    billPayOrderId: number;
    /** 业务单号快照 BP-* */
    code: string;
    channelId: number;
    /** 商家名称快照 */
    merchantName: string;
    /** 平台报价（客户应付） */
    quoteAmount: number;
    /** 实际账单原价 */
    actualAmount: number;
    /** 协议结算费率快照（百分数整数） */
    settleRate: number;
    /** 成本 = round(actualAmount × settleRate / 100) */
    costAmount: number;
    /** 毛利 = quoteAmount − costAmount */
    grossAmount: number;
    /** 记账时点 */
    occurredAt: Date;
}
