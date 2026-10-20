import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, Unique } from 'typeorm';

import { CouponSettlementStatus } from './types';

/**
 * 券结算单（买单券资金流 T1，对标设计文档「服务商分账模式」）：
 * 用户购买券（资金冻结于微信待分账）→ 到店核销 → T+1 生成/提交结算单 → 分账给特约商户。
 * 售出即结算 = 二清红线，故结算单必须以「核销」为唯一前提（redeemRef 关联核销凭证）。
 * 金额单位：分；佣金费率单位：万分比（bp，500 = 5%）。
 */
@Entity()
@Index(['channelId', 'status'])
// 一张券实例至多一条结算单（券只能核销一次）——唯一约束防重复出单（风险铁律④）
@Unique(['customerCouponId'])
export class CouponSettlementOrder extends VendureEntity {
    constructor(input?: DeepPartial<CouponSettlementOrder>) {
        super(input);
    }

    /** 结算归属租户渠道 id */
    @Column('bigint')
    channelId: number;

    /** 券单 id（资金来源 CouponSaleOrder.id；历史数据/异常兜底时可能为 null） */
    @Column({ type: 'int', nullable: true })
    saleOrderId: number | null;

    /** 被核销券实例 id（customer_coupon.id，唯一） */
    @Column({ type: 'int' })
    customerCouponId: number;

    /** 券模板 id 快照 */
    @Column({ type: 'int', nullable: true })
    templateId: number | null;

    /** 核销凭证（幂等溯源）：BILL:{inStoreBillId} */
    @Column('varchar')
    redeemRef: string;

    /** 到店买单流水 id（P0 结算登记仅来自到店核销；线上核销折算口径后续任务） */
    @Column({ type: 'int', nullable: true })
    inStoreBillId: number | null;

    /** 面额折算额（分）= 核销优惠额（商家应得基数） */
    @Column({ type: 'int' })
    faceAmount: number;

    /** 佣金费率快照（万分比，出单时烧录，费率后续调整不影响已出结算单） */
    @Column({ type: 'int', default: 0 })
    commissionRateBp: number;

    /** 佣金额（分）= faceAmount * commissionRateBp / 10000 */
    @Column({ type: 'int', default: 0 })
    commissionAmount: number;

    /** 净付额（分）= faceAmount - commissionAmount（分账给商户的金额） */
    @Column({ type: 'int', default: 0 })
    netAmount: number;

    /** 状态机：PENDING → SETTLED → PAID_OUT；REVERSED（追偿）/CANCELLED（核销回退） */
    @Column('varchar')
    status: CouponSettlementStatus;

    /** 结算单号（分账幂等键，CSTL-{channelId}-{customerCouponId}，唯一） */
    @Column('varchar')
    @Index({ unique: true })
    settlementNo: string;

    /** 分账模式快照（提交时烧录）：stub | wechat */
    @Column('varchar', { nullable: true })
    splitMode: string | null;

    /** 分账回执号（网关受理后返回） */
    @Column('varchar', { nullable: true })
    splitReceiptNo: string | null;

    /** 分账提交重试次数（重试队列） */
    @Column({ type: 'int', default: 0 })
    attempts: number;

    /** 最近一次提交/回执错误（重试队列排查用） */
    @Column('text', { nullable: true })
    lastError: string | null;

    /** 分账受理时间（禁用 `| null` 联合类型：lib 编译后 design:type 变 Object，TypeORM 无法推断列型） */
    @Column({ nullable: true })
    settledAt?: Date;

    /** 分账完成（回执 FINISHED）时间 */
    @Column({ nullable: true })
    paidOutAt?: Date;

    /** 追偿完成时间（T8 退款联动） */
    @Column({ nullable: true })
    reversedAt?: Date;

    /** 发票凭证类型预留（T6）：'601' 商品销售 / 'CONSUMPTION' 消费 / 'COMMISSION' 佣金；结算登记默认 '601'，开票对接前仅留痕 */
    @Column('varchar', { nullable: true })
    voucherType: string | null;

    /** 备注 */
    @Column('varchar', { nullable: true })
    remark: string | null;
}
