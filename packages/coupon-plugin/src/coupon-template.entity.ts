import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

import { LocalizedText } from './localize';
import { CouponScope, CouponType } from './types';

/**
 * 多语言文本的 DB 列转换：DB 内始终以字符串落库（纯字符串原样存；对象/JSON 字符串存
 * 序列化结果），读写时原样保留，使实体上的 `name`/`description` 既可能是纯字符串
 * （历史数据），也可能是 `LocalizedText` 对象（多语言），而无需迁移列类型。
 */
const localizedTextColumn = {
    to: (value: LocalizedText | null | undefined) =>
        value == null ? value : typeof value === 'string' ? value : JSON.stringify(value),
    from: (value: LocalizedText | null | undefined) => value,
};

/**
 * 券模板：后台可配置的券规则。
 */
@Entity()
export class CouponTemplate extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CouponTemplate>) {
        super(input);
    }

    /**
     * 券名（LocalizedText：纯字符串或按 LanguageCode 键的多语言映射，兼容既有 `string`）。
     * 为了兼容既有以 varchar/text 存储的历史明文，列类型保持文本型而非 `json`，
     * 并通过 transformer 在保存时对对象做序列化落库。
     */
    @Column('text', { nullable: false, transformer: localizedTextColumn })
    name: LocalizedText;

    /** 券说明（LocalizedText，可空）。 */
    @Column('text', { nullable: true, transformer: localizedTextColumn })
    description?: LocalizedText;

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

    /** 详情页领券入口开关（binding.enabled && claimable 才展示领券入口） */
    @Column({ default: true }) claimable: boolean;

    /** 兑换码（非空=支持凭码兑换；同租户内唯一由 service 层保证） */
    @Column('varchar', { nullable: true }) claimCode?: string;

    /** 领取后 N 天有效（空=走固定 startsAt/endsAt） */
    @Column({ nullable: true }) validDays?: number;

    /** 仅限新客（本租户无历史有效订单）可领可用 */
    @Column({ default: false }) newCustomerOnly: boolean;

    /** 会员等级限定（预留，本期只建字段不开发逻辑） */
    @Column('varchar', { nullable: true }) memberLevel?: string;

    /** 发行归属店铺 id（跨渠道范围用）：默认商城下仅对「本店商品行」核销。 */
    @Column('bigint', { nullable: true }) shopId?: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}