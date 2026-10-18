import {
    BillPayChannelConfig,
    BillPayRule,
    DEFAULT_BILLPAY_CONFIG,
    isQuoteRejected,
    LocalizedLabel,
    QuoteDiscountItem,
    QuoteOutcome,
    QuoteRejected,
} from './types';

export { isQuoteRejected };

/**
 * 报价引擎（纯函数，不走 Vendure 促销引擎）：对齐设计文档 §4。
 * 全程分单位整数运算；叠加顺序：会员折扣 → 最优满减档（reduce 最大）。
 */

function roundDiv(amount: number, divisor: number): number {
    return Math.round(amount / divisor);
}

/**
 * 按规则报价。
 * - 金额非法（<=0）→ INVALID_AMOUNT；
 * - 低于 minAmount → BELOW_MIN（不接单）；
 * - 高于 maxAmount → ABOVE_MAX（转人工）；
 * - 会员折扣先按 percent 折算（四舍五入到分），满减档再对折扣后金额取最优档。
 */
export function quoteBill(expectedAmount: number, rule: BillPayRule): QuoteOutcome {
    const amount = Math.round(Number(expectedAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
        return { payable: null, discountDetail: [], reason: 'INVALID_AMOUNT' } as QuoteRejected;
    }
    if (amount < rule.minAmount) {
        return { payable: null, discountDetail: [], reason: 'BELOW_MIN' } as QuoteRejected;
    }
    if (amount > rule.maxAmount) {
        return { payable: null, discountDetail: [], reason: 'ABOVE_MAX' } as QuoteRejected;
    }
    const discountDetail: QuoteDiscountItem[] = [];
    let payable = amount;

    const md = rule.memberDiscount;
    if (md && Number(md.percent) > 0 && Number(md.percent) < 100) {
        const afterDiscount = roundDiv(amount * Number(md.percent), 100);
        if (afterDiscount < payable) {
            discountDetail.push({
                rule: 'memberDiscount',
                label: md.label,
                amount: payable - afterDiscount,
            });
            payable = afterDiscount;
        }
    }

    const thresholds = Array.isArray(rule.thresholds) ? rule.thresholds : [];
    let best: { minSpend: number; reduce: number; label?: LocalizedLabel } | null = null;
    for (const t of thresholds) {
        const minSpend = Math.round(Number(t?.minSpend));
        const reduce = Math.round(Number(t?.reduce));
        if (!Number.isFinite(minSpend) || !Number.isFinite(reduce) || reduce <= 0) {
            continue;
        }
        if (payable >= minSpend && (!best || reduce > best.reduce)) {
            best = { minSpend, reduce, label: t.label };
        }
    }
    if (best && best.reduce < payable) {
        discountDetail.push({ rule: 'threshold', label: best.label, amount: best.reduce });
        payable -= best.reduce;
    }

    return { payable, discountDetail };
}

function num(v: unknown, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * 渠道配置解析（SSR 友好纯函数）：坏 JSON / 缺字段逐字段回退默认值，
 * 对齐项目 detail-config 的「坏配置返回默认、不抛错」模式。
 */
export function parseBillPayConfig(raw: unknown): BillPayChannelConfig {
    if (raw == null) {
        return { ...DEFAULT_BILLPAY_CONFIG };
    }
    let obj: any = raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) {
            return { ...DEFAULT_BILLPAY_CONFIG };
        }
        try {
            obj = JSON.parse(trimmed);
        } catch {
            return { ...DEFAULT_BILLPAY_CONFIG };
        }
    }
    if (typeof obj !== 'object' || obj == null) {
        return { ...DEFAULT_BILLPAY_CONFIG };
    }

    const config: BillPayChannelConfig = {
        autoQuote: typeof obj.autoQuote === 'boolean' ? obj.autoQuote : DEFAULT_BILLPAY_CONFIG.autoQuote,
        quoteExpireMinutes: num(obj.quoteExpireMinutes, DEFAULT_BILLPAY_CONFIG.quoteExpireMinutes) > 0
            ? num(obj.quoteExpireMinutes, DEFAULT_BILLPAY_CONFIG.quoteExpireMinutes)
            : DEFAULT_BILLPAY_CONFIG.quoteExpireMinutes,
        couponEnabled: typeof obj.couponEnabled === 'boolean' ? obj.couponEnabled : false,
        tolerancePercent: num(obj.tolerancePercent, DEFAULT_BILLPAY_CONFIG.tolerancePercent),
        dailyLimitAmount: num(obj.dailyLimitAmount, DEFAULT_BILLPAY_CONFIG.dailyLimitAmount),
        minAmount: num(obj.minAmount, DEFAULT_BILLPAY_CONFIG.minAmount),
        maxAmount: num(obj.maxAmount, DEFAULT_BILLPAY_CONFIG.maxAmount),
        memberDiscount: null,
        thresholds: [],
    };

    if (obj.memberDiscount && typeof obj.memberDiscount === 'object') {
        const percent = num(obj.memberDiscount.percent, 0);
        if (percent > 0 && percent < 100) {
            config.memberDiscount = {
                percent,
                label: (obj.memberDiscount.label as LocalizedLabel) ?? undefined,
            };
        }
    }

    if (Array.isArray(obj.thresholds)) {
        config.thresholds = obj.thresholds
            .map((t: any) => ({
                minSpend: Math.round(num(t?.minSpend, 0)),
                reduce: Math.round(num(t?.reduce, 0)),
                label: (t?.label as LocalizedLabel) ?? undefined,
            }))
            .filter((t: any) => t.minSpend > 0 && t.reduce > 0);
    }

    if (config.minAmount <= 0) {
        config.minAmount = DEFAULT_BILLPAY_CONFIG.minAmount;
    }
    if (config.maxAmount < config.minAmount) {
        config.maxAmount = DEFAULT_BILLPAY_CONFIG.maxAmount;
    }
    if (config.dailyLimitAmount < config.minAmount) {
        config.dailyLimitAmount = DEFAULT_BILLPAY_CONFIG.dailyLimitAmount;
    }
    return config;
}
