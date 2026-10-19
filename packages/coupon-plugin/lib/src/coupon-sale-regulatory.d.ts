import { CouponTemplate } from './coupon-template.entity';
/**
 * 买单券监管参数组（T4，渠道级 Channel customFields.billpay*）服务端校验。
 * 口径：默认宽松向后兼容——参数未配置（null/<=0）时完全不生效；配置后才硬校验。
 * 线上购买入口（券商城 createSaleOrder / 加价购 attachCouponToOrder）统一走本模块。
 */
export interface BillpayRegulatoryLimits {
    /** 售价上限（分） */
    maxSalePrice: number | null;
    /** 单券面额上限（分） */
    maxFaceValue: number | null;
    /** 券包总面额上限（分） */
    maxBundleTotal: number | null;
    /** 最短有效天数 */
    minValidDays: number | null;
}
/** 从 Channel 实体读监管参数（customFields 未配置 → 全 null = 宽松） */
export declare function extractBillpayLimits(channel: any): BillpayRegulatoryLimits;
/**
 * 静态面额折算：FIXED/FULL/FREE_SHIPPING 面额 = discountValue（分）；
 * PERCENT 的 discountValue 是折数（80 = 8 折），面额随消费金额浮动无法静态折算 → null（跳过面额校验，
 * 其资金上限由 maxSalePrice 兜底）。
 */
export declare function templateFaceValue(tpl: Pick<CouponTemplate, 'type' | 'discountValue'>): number | null;
/** 单券监管校验：售价 / 静态面额 / 最短有效天数（P0 expireRefundPolicy 仅存档展示，不强制） */
export declare function assertTemplateWithinRegulatoryLimits(tpl: CouponTemplate, limits: BillpayRegulatoryLimits): void;
/** 券包监管校验：整包售价 / 包内静态面额合计（模板缺失时按 0 计，由 assertBundleStock 另行拦截） */
export declare function assertBundleWithinRegulatoryLimits(bundleSalePrice: number, templates: (CouponTemplate | undefined | null)[], quantities: number[], limits: BillpayRegulatoryLimits): void;
