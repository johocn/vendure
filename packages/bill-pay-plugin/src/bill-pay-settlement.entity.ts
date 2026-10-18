import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 代买单结算台账（设计文档 §3 SETTLED / §10）。
 *
 * 独立于 cjk-plugin 的 merchant_settlement_ledger：该表消费方不按类型过滤且 orderId 与
 * Vendure Order 共用数字 id 会冲突（§15 护栏「先确认所有 ledger 消费方按类型过滤汇总」
 * 前提不成立），故按纯增量原则自建台账表，月度对账/报表从本表出。
 * 金额单位：分。毛利 = quoteAmount − costAmount（差价模型）。
 */
@Entity('bill_pay_settlement')
export class BillPaySettlement extends VendureEntity {
    constructor(input?: DeepPartial<BillPaySettlement>) {
        super(input);
    }

    @Index({ unique: true })
    @Column({ type: 'int' })
    billPayOrderId: number;

    /** 业务单号快照 BP-* */
    @Column({ type: 'varchar' })
    code: string;

    @Index()
    @Column({ type: 'int' })
    channelId: number;

    /** 商家名称快照 */
    @Column({ type: 'varchar' })
    merchantName: string;

    /** 平台报价（客户应付） */
    @Column({ type: 'int' })
    quoteAmount: number;

    /** 实际账单原价 */
    @Column({ type: 'int' })
    actualAmount: number;

    /** 协议结算费率快照（百分数整数） */
    @Column({ type: 'int' })
    settleRate: number;

    /** 成本 = round(actualAmount × settleRate / 100) */
    @Column({ type: 'int' })
    costAmount: number;

    /** 毛利 = quoteAmount − costAmount */
    @Column({ type: 'int' })
    grossAmount: number;

    /** 记账时点 */
    @Column({ type: 'timestamp' })
    occurredAt: Date;
}
