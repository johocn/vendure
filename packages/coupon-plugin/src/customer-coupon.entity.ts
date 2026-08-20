import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

import { CouponIssuedBy, CouponStatus } from './types';
import { CouponTemplate } from './coupon-template.entity';

/**
 * 用户券：用户领取/被定向发放后的实例。
 */
@Entity()
@Index(['customerId', 'templateId'])
export class CustomerCoupon extends VendureEntity {
    constructor(input?: DeepPartial<CustomerCoupon>) {
        super(input);
    }

    /** 归属用户（Customer.id） */
    @Column() customerId: number;

    /** 所属券模板（CouponTemplate.id） */
    @Column() templateId: number;

    /** 关联券模板 */
    @ManyToOne(() => CouponTemplate, { nullable: true })
    @JoinColumn({ name: 'templateId' })
    template?: CouponTemplate;

    /** 唯一券码（可推广/展示） */
    @Column({ unique: true })
    @Index({ unique: true })
    code: string;

    /** 状态 */
    @Column('varchar', { default: 'UNUSED' }) status: CouponStatus;

    /** 发券来源 */
    @Column('varchar', { default: 'CENTRE' }) issuedBy: CouponIssuedBy;

    /** 预约锁定的订单 id */
    @Column('varchar', { nullable: true }) reservedOrderId?: ID;

    /** 已核销订单 id */
    @Column('varchar', { nullable: true }) usedOrderId?: ID;

    /** 领取时间 */
    @Column({ nullable: true }) issuedAt?: Date;

    /** 核销时间 */
    @Column({ nullable: true }) usedAt?: Date;

    /** 过期时间（快照模板 endsAt，回退/过期判定用） */
    @Column({ nullable: true }) expiredAt?: Date;
}