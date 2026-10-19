import { UserInputError } from '@vendure/core';

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

const toPositiveInt = (v: any): number | null => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
};

/** 从 Channel 实体读监管参数（customFields 未配置 → 全 null = 宽松） */
export function extractBillpayLimits(channel: any): BillpayRegulatoryLimits {
    const cf = channel?.customFields ?? {};
    return {
        maxSalePrice: toPositiveInt(cf.billpayMaxSalePrice),
        maxFaceValue: toPositiveInt(cf.billpayMaxFaceValue),
        maxBundleTotal: toPositiveInt(cf.billpayMaxBundleTotal),
        minValidDays: toPositiveInt(cf.billpayMinValidDays),
    };
}

/**
 * 静态面额折算：FIXED/FULL/FREE_SHIPPING 面额 = discountValue（分）；
 * PERCENT 的 discountValue 是折数（80 = 8 折），面额随消费金额浮动无法静态折算 → null（跳过面额校验，
 * 其资金上限由 maxSalePrice 兜底）。
 */
export function templateFaceValue(tpl: Pick<CouponTemplate, 'type' | 'discountValue'>): number | null {
    if (!tpl || tpl.type === 'PERCENT') return null;
    const v = Math.floor(Number(tpl.discountValue));
    return Number.isFinite(v) && v > 0 ? v : null;
}

function assertSalePriceWithinLimits(salePrice: number, limits: BillpayRegulatoryLimits): void {
    if (limits.maxSalePrice != null && salePrice > limits.maxSalePrice) {
        throw new UserInputError(
            `Sale price ${salePrice} exceeds channel limit ${limits.maxSalePrice} (billpayMaxSalePrice)`,
        );
    }
}

/** 单券监管校验：售价 / 静态面额 / 最短有效天数（P0 expireRefundPolicy 仅存档展示，不强制） */
export function assertTemplateWithinRegulatoryLimits(
    tpl: CouponTemplate,
    limits: BillpayRegulatoryLimits,
): void {
    assertSalePriceWithinLimits(Number(tpl.salePrice ?? 0), limits);
    const face = templateFaceValue(tpl);
    if (face != null && limits.maxFaceValue != null && face > limits.maxFaceValue) {
        throw new UserInputError(
            `Coupon face value ${face} exceeds channel limit ${limits.maxFaceValue} (billpayMaxFaceValue)`,
        );
    }
    if (limits.minValidDays != null && tpl.validDays != null && Number(tpl.validDays) < limits.minValidDays) {
        throw new UserInputError(
            `Coupon validity ${tpl.validDays} days is shorter than channel minimum ${limits.minValidDays} (billpayMinValidDays)`,
        );
    }
}

/** 券包监管校验：整包售价 / 包内静态面额合计（模板缺失时按 0 计，由 assertBundleStock 另行拦截） */
export function assertBundleWithinRegulatoryLimits(
    bundleSalePrice: number,
    templates: (CouponTemplate | undefined | null)[],
    quantities: number[],
    limits: BillpayRegulatoryLimits,
): void {
    assertSalePriceWithinLimits(bundleSalePrice, limits);
    if (limits.maxBundleTotal == null) return;
    let total = 0;
    templates.forEach((tpl, i) => {
        const face = tpl ? templateFaceValue(tpl) : null;
        if (face != null) total += face * Math.max(1, Math.floor(quantities[i] ?? 1));
    });
    if (total > limits.maxBundleTotal) {
        throw new UserInputError(
            `Bundle total face value ${total} exceeds channel limit ${limits.maxBundleTotal} (billpayMaxBundleTotal)`,
        );
    }
}
