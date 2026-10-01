import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/**
 * 到店买单流水：平台不收款、不生成线上订单，仅记录「商户线下收款 + 用券优惠」留痕。
 * 冗余券名/顾客名/折扣等快照，模板或顾客改名后仍可追溯。
 */
@Entity()
@Index(['channelId', 'billedAt'])
export class InStoreBill extends VendureEntity {
    constructor(input?: DeepPartial<InStoreBill>) {
        super(input);
    }

    /** 核销发生的租户渠道 id（流水按此隔离） */
    @Column('bigint') channelId: ID;

    /** 被核销的用户券 id（customer_coupon.id） */
    @Column() customerCouponId: number;

    /** 券码快照 */
    @Column('varchar') @Index() couponCode: string;

    /** 券模板 id 快照 */
    @Column() couponTemplateId: number;

    /** 券名快照（模板改名后仍可追溯） */
    @Column('varchar', { nullable: true }) couponName?: string;

    /** 顾客 id */
    @Column() @Index() customerId: number;

    /** 顾客名快照 */
    @Column('varchar', { nullable: true }) customerName?: string;

    /** 顾客手机号快照 */
    @Column('varchar', { nullable: true }) customerPhone?: string;

    /** 券类型快照：PERCENT | FIXED | FULL */
    @Column('varchar') discountType: string;

    /** 券折扣值快照：PERCENT 为折数（80 = 8 折），FIXED/FULL 为分 */
    @Column() discountValue: number;

    /** 原价（分），商户手填 */
    @Column() originalAmount: number;

    /** 优惠额（分） */
    @Column() discountAmount: number;

    /** 实付（分） */
    @Column() finalAmount: number;

    /** 核销管理员 id */
    @Column() operatorId: number;

    /** 核销人名称快照 */
    @Column('varchar', { nullable: true }) operatorName?: string;

    /** 备注 */
    @Column('varchar', { nullable: true }) remark?: string;

    /** 核销（买单）时间 */
    @Column() billedAt: Date;
}
