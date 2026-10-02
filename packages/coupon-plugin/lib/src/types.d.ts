/**
 * 券类型：
 * - FIXED ：满 minSpend 减 discountValue（满减）
 * - PERCENT ：满 minSpend 打 discountValue 折（1-99 整数，如 8.5折 → 85）
 * - FULL ：无门槛直减 discountValue（minSpend 强制 0）
 * - FREE_SHIPPING ：免邮券，折扣额 = 订单配送线小计（加购后需有配送线才生效）
 */
export type CouponType = 'FIXED' | 'PERCENT' | 'FULL' | 'FREE_SHIPPING';
/**
 * 用户券状态：
 * - UNUSED  ：已领取未使用（可结算选券）
 * - USED    ：支付成功已核销（usedOrderId 落单）
 * - RETURNED：取消订单后回退（可再次使用）
 * - EXPIRED ：已过期
 * - INVALID ：admin 撤销作废（未用券）
 */
export type CouponStatus = 'UNUSED' | 'USED' | 'RETURNED' | 'EXPIRED' | 'INVALID';
/** 发券来源（SALE = 出售渠道生成，计划 2 新增） */
export type CouponIssuedBy = 'CENTRE' | 'ADMIN' | 'EXCHANGE' | 'SALE';
/** 券适用范围 */
export type CouponScope = 'ALL' | 'CATEGORY' | 'SKU';
/**
 * 券使用场景：
 * - ONLINE   ：仅可用于线上订单（历史数据默认值，语义与改造前一致）
 * - IN_STORE ：仅可用于到店买单核销
 * - ALL      ：线上与到店皆可
 */
export type CouponUsageScene = 'ONLINE' | 'IN_STORE' | 'ALL';
export interface CouponPluginOptions {
    /** 券码展示前缀，默认 'C' */
    codePrefix?: string;
}
/** coupon_applied 条件返回给 coupon_discount 动作的 state 形状 */
export interface CouponAppliedConditionState {
    discountAmount: number;
}
/** 创建商品绑券入参 */
export interface CreateProductCouponBindingInput {
    productId: number;
    variantIds?: number[] | null;
    couponTemplateId: number;
    enabled?: boolean;
    displayOrder?: number;
    badgeText?: string;
    promoTitle?: string;
    remark?: string;
    perUserClaimLimit?: number | null;
    claimWindowStart?: Date | null;
    claimWindowEnd?: Date | null;
    claimStock?: number | null;
    channelId?: number | null;
}
/** 更新商品绑券入参（不含 productId / couponTemplateId / channelId，绑定归属不可改） */
export interface UpdateProductCouponBindingInput {
    id: number;
    variantIds?: number[] | null;
    enabled?: boolean;
    displayOrder?: number;
    badgeText?: string;
    promoTitle?: string;
    remark?: string;
    perUserClaimLimit?: number | null;
    claimWindowStart?: Date | null;
    claimWindowEnd?: Date | null;
    claimStock?: number | null;
}
/**
 * 券分发渠道（券模板可被分发/获取的入口）：
 * - CENTRE  ：优惠券中心领取
 * - SALE    ：出售（券商城 / 商品页加价购）
 * - POINTS  ：积分换购
 * - CODE    ：优惠码兑换
 * - PRODUCT ：浏览指定商品领取
 * - GRANT   ：定向发放
 */
export type CouponChannel = 'CENTRE' | 'SALE' | 'POINTS' | 'CODE' | 'PRODUCT' | 'GRANT';
/**
 * 出售单支付方式：
 * - WECHAT            ：券商城独立微信支付（outTradeNo 前缀 CS-）
 * - BALANCE           ：券商城余额支付（可选依赖 recharge-card 余额服务）
 * - ORDER_SURCHARGE   ：商品页加价购，券价随主订单结算
 */
export type CouponSalePayMode = 'WECHAT' | 'BALANCE' | 'ORDER_SURCHARGE';
/** 出售单状态 */
export type CouponSaleStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
/** 券包内单项入参 */
export interface CouponBundleItemInput {
    templateId: number;
    quantity?: number | null;
}
