import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 结算对账差异（买单券资金流 T5）：
 * 每轮对账（runId）把差异落表；台账页默认展示最新一轮的未解决差异。
 * 上一轮未解决差异在新一轮跑批时被整体替换（对账语义 = 当前快照），
 * 已人工处理（resolvedAt 非空）的记录保留作审计。
 */
@Entity()
@Index(['channelId', 'runId'])
@Index(['channelId', 'severity'])
export class CouponSettlementReconcileDiff extends VendureEntity {
    constructor(input?: DeepPartial<CouponSettlementReconcileDiff>) {
        super(input);
    }

    /** 对账轮次号（RCN-{channelId}-{yyyyMMddHHmmss}，同轮内幂等） */
    @Column('varchar')
    runId: string;

    /** 对账归属租户渠道 id */
    @Column('bigint')
    channelId: number;

    /** 关联结算单 id（单边缺失「缺结算单」场景为 null） */
    @Column({ type: 'int', nullable: true })
    settlementOrderId: number | null;

    /** 结算单号快照（缺结算单场景为 null） */
    @Column('varchar', { nullable: true })
    settlementNo: string | null;

    /** 差异类型（ReconcileDiffType）：AMOUNT_MISMATCH / MISSING_RECEIPT / ... */
    @Column('varchar')
    diffType: string;

    /** 严重度：HIGH（资损级）/ MEDIUM（卡单）/ LOW（提示） */
    @Column('varchar')
    severity: string;

    /** 差异详情（JSON 快照：金额、回执状态、卡单时长等排查上下文） */
    @Column('text', { nullable: true })
    detail: string | null;

    /** 人工处理时间（禁用 `| null` 联合类型：lib 编译后 design:type 变 Object，TypeORM 无法推断列型） */
    @Column({ nullable: true })
    resolvedAt?: Date;

    /** 处理备注 */
    @Column('varchar', { nullable: true })
    remark: string | null;
}
