import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { LocalizedText } from './localize';
import { CouponScope, CouponType } from './types';
/**
 * 券模板：后台可配置的券规则。
 */
export declare class CouponTemplate extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CouponTemplate>);
    /**
     * 券名（LocalizedText：纯字符串或按 LanguageCode 键的多语言映射，兼容既有 `string`）。
     * 为了兼容既有以 varchar/text 存储的历史明文，列类型保持文本型而非 `json`，
     * 并通过 transformer 在保存时对对象做序列化落库。
     */
    name: LocalizedText;
    /** 券说明（LocalizedText，可空）。 */
    description?: LocalizedText;
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
    /** 积分兑换价（0=不可积分兑换，仅普通领取） */
    pointsPrice: number;
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
    /** 发行归属店铺 id（跨渠道范围用）：默认商城下仅对「本店商品行」核销。 */
    shopId?: number;
    channels: Channel[];
}
