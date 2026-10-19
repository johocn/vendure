import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 沉睡召回批量发放批次（FR-E1）：结果可查询的留痕实体。
 * 每执行一次 couponWinBackGrant 落一条，resultsJson 保存逐人明细（customerId/ok/code/reason）。
 */
@Entity()
export class CouponGrantBatch extends VendureEntity {
    constructor(input?: DeepPartial<CouponGrantBatch>) {
        super(input);
    }

    /** 渠道（租户）id */
    @Column() channelId: number;

    /** 奖励券模板 id */
    @Column() templateId: number;

    /** 圈人参数：N 天未消费 */
    @Column({ default: 90 }) days: number;

    /** 圈中人数 */
    @Column({ default: 0 }) totalSelected: number;

    /** 发放成功人数 */
    @Column({ default: 0 }) issuedCount: number;

    /** 拦截/失败人数 */
    @Column({ default: 0 }) skippedCount: number;

    /** 逐人结果明细 JSON */
    @Column('text', { nullable: true }) resultsJson?: string | null;

    /** 操作人（Administrator 标识，空=系统） */
    @Column('varchar', { nullable: true }) operator?: string | null;

    /** 本批次是否已触达通知 */
    @Column({ default: false }) notified: boolean;
}
