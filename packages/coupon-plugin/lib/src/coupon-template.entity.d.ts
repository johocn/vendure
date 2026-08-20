import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { CouponScope, CouponType } from './types';
/**
 * 券模板：后台可配置的券规则。
 */
export declare class CouponTemplate extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CouponTemplate>);
    /** 券名 */
    name: string;
    /** FIXED | PERCENT | FULL */
    type: CouponType;
    /** 面额（FIXED/FULL）或折扣折数（PERCENT，1-99，如 8.5折=85） */
    discountValue: number;
    /** 使用门槛（满 X 元起，0=无门槛） */
    minSpend: number;
    /** 生效起始时间 */
    startsAt?: Date;
    /** 生效结束时间 */
    endsAt?: Date;
    /** 发行总量（0=不限） */
    totalCount: number;
    /** 已领取/已发放计数 */
    claimedCount: number;
    /** 每人限领（0=不限） */
    perUserLimit: number;
    /** 适用范围 ALL|CATEGORY|SKU */
    scope: CouponScope;
    /** scope=CATEGORY 时关联的分类 id */
    categoryId?: number;
    /** scope=SKU 时关联的 variant id */
    variantId?: number;
    /** 上下架 */
    enabled: boolean;
    channels: Channel[];
}
