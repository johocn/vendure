import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 每日领券记录（FR-F1）：同渠道同人同券同「业务日」仅一条（唯一索引）——
 * 既是「每人每券每天 1 张」的规则载体，也是发放幂等（R3）的原子保障：
 * 发券与落记录同事务，唯一冲突即整体回滚（claimDate 为 UTC+8 业务日）。
 */
@Entity()
@Index(['channelId', 'customerId', 'templateId', 'claimDate'], { unique: true })
export class CouponDailyClaimRecord extends VendureEntity {
    constructor(input?: DeepPartial<CouponDailyClaimRecord>) {
        super(input);
    }

    /** 渠道（租户）id */
    @Column() channelId: number;

    /** 领取人（Customer.id） */
    @Column() customerId: number;

    /** 券模板 id */
    @Column() templateId: number;

    /** 业务日（UTC+8，'YYYY-MM-DD'） */
    @Column('varchar', { length: 10 }) claimDate: string;

    /** 发放的券（CustomerCoupon.id；SOLD_OUT 等未发券为 null） */
    @Column('int', { nullable: true }) couponId: number | null;
}
