import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

import { CouponScope, CouponType } from './types';

/**
 * 券模板：后台可配置的券规则。
 */
@Entity()
export class CouponTemplate extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CouponTemplate>) {
        super(input);
    }

    /** 券名 */
    @Column() name: string;

    /** FIXED | PERCENT | FULL */
    @Column('varchar') type: CouponType;

    /** 面额（FIXED/FULL）或折扣折数（PERCENT，1-99，如 8.5折=85） */
    @Column() discountValue: number;

    /** 使用门槛（满 X 元起，0=无门槛） */
    @Column({ default: 0 }) minSpend: number;

    /** 生效起始时间 */
    @Column({ nullable: true }) startsAt?: Date;

    /** 生效结束时间 */
    @Column({ nullable: true }) endsAt?: Date;

    /** 发行总量（0=不限） */
    @Column({ default: 0 }) totalCount: number;

    /** 已领取/已发放计数 */
    @Column({ default: 0 }) claimedCount: number;

    /** 积分兑换价（0=不可积分兑换，仅普通领取） */
    @Column({ default: 0 }) pointsPrice: number;

    /** 每人限领（0=不限） */
    @Column({ default: 0 }) perUserLimit: number;

    /** 适用范围 ALL|CATEGORY|SKU */
    @Column('varchar', { default: 'ALL' }) scope: CouponScope;

    /** scope=CATEGORY 时关联的分类 id */
    @Column({ nullable: true }) categoryId?: number;

    /** scope=SKU 时关联的 variant id */
    @Column({ nullable: true }) variantId?: number;

    /** 上下架 */
    @Column({ default: true }) enabled: boolean;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}