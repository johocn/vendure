import { LanguageCode, ShippingCalculator, ShippingEligibilityChecker } from '@vendure/core';

import { memberTierLookup } from './tier-lookup';

/**
 * 会员等级免运费门槛 checker。
 * 判定条件（写入 check，勿用 shouldRunCheck 缓存——等级随顾客成长值/渠道配置外部变化）：
 * 1. channel.freeShippingLevel > 0 才启用；否则不适用（返回 false）。
 * 2. 当前顾客档位 tierLevel >= channel.freeShippingLevel 即该方式适用。
 * 不适用（未启用 / 等级不足 / 无 customer）返回 false → 结算不展示该运费方式 → calculator 不执行。
 */
export const tierFreeShippingEligibilityChecker = new ShippingEligibilityChecker({
    code: 'member-tier-free-shipping-eligibility',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '会员等级免运费门槛' },
        { languageCode: LanguageCode.en, value: 'Member Tier Free Shipping Eligibility' },
    ],
    args: {},
    init(injector) {
        memberTierLookup.init(injector);
    },
    check: async (ctx, order) => {
        const freeShippingLevel = (ctx.channel as any)?.customFields?.freeShippingLevel ?? 0;
        if (freeShippingLevel <= 0) {
            return false;
        }
        const customerId = (order as any)?.customer?.id;
        if (customerId == null) {
            return false;
        }
        const tier = await memberTierLookup.tierForCustomer(ctx, customerId);
        return tier.tierLevel >= freeShippingLevel;
    },
});

/**
 * 会员等级免运费 calculator：报价 0 元（含税）。
 * 仅当勾选该 calculator 的运费方式被选中（checker 通过）时计算，返回 0 即免运费。
 */
export const tierFreeShippingCalculator = new ShippingCalculator({
    code: 'member-tier-free-shipping',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '会员等级免运费（0 元）' },
        { languageCode: LanguageCode.en, value: 'Member Tier Free Shipping' },
    ],
    args: {},
    calculate: async () => ({
        price: 0,
        priceIncludesTax: true,
        taxRate: 0,
        metadata: { freeShipping: true },
    }),
});