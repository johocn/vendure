import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

import { CouponTemplate } from './coupon-template.entity';

/**
 * 商品绑定券：运营层配置「某商品（可细化到多个 variant）可领取某张券模板」，
 * 结算时按 binding 集合判定订单行是否命中。channelId 用于租户隔离（大整数列）。
 */
@Entity()
@Index(['productId', 'channelId'])
@Index(['couponTemplateId'])
export class ProductCouponBinding extends VendureEntity {
    constructor(input?: DeepPartial<ProductCouponBinding>) {
        super(input);
    }

    /** 商品 id（Product.id） */
    @Column() productId: number;

    /** 多规格细化；空=商品全 SKU */
    @Column('simple-json', { nullable: true }) variantIds?: number[];

    /** 券模板 id（CouponTemplate.id） */
    @Column() couponTemplateId: number;

    /** 关联券模板 */
    @ManyToOne(() => CouponTemplate, { nullable: true })
    @JoinColumn({ name: 'couponTemplateId' })
    template?: CouponTemplate;

    /** 启停（详情页展示需 binding.enabled && 模板 enabled && 模板 claimable） */
    @Column({ default: true }) enabled: boolean;

    /** 租户渠道 id（bigint，租户隔离过滤用） */
    @Column('bigint', { nullable: true }) channelId?: number;

    /** 展示排序（升序） */
    @Column({ default: 0 }) displayOrder: number;

    /* 预留字段：本期仅建字段不开发行为；结算/领取均忽略，勿误以为已生效。 */
    @Column({ nullable: true }) perUserClaimLimit?: number;

    /* 预留字段：本期仅建字段不开发行为；结算/领取均忽略，勿误以为已生效。 */
    @Column({ nullable: true }) claimWindowStart?: Date;
    @Column({ nullable: true }) claimWindowEnd?: Date;

    /* 预留字段：本期仅建字段不开发行为；结算/领取均忽略，勿误以为已生效。 */
    @Column({ nullable: true }) claimStock?: number;

    /* 预留字段：本期仅建字段不开发行为；结算/领取均忽略，勿误以为已生效。 */
    @Column('varchar', { nullable: true }) badgeText?: string;

    /* 预留字段：本期仅建字段不开发行为；结算/领取均忽略，勿误以为已生效。 */
    @Column('varchar', { nullable: true }) promoTitle?: string;

    /* 预留字段：本期仅建字段不开发行为；结算/领取均忽略，勿误以为已生效。 */
    @Column('varchar', { nullable: true }) remark?: string;
}
