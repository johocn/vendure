import { LanguageCode, PromotionCondition, RequestContext } from '@vendure/core';

import { memberTierLookup } from './tier-lookup';

/**
 * 会员等级门槛条件：读订单顾客当前档位，>= minLevel（channel 配置 freeShippingLevel 之外的促销专用门槛，
 * 以 args.minLevel 为准）即通过，返回 state `{ tierLevel, specialDiscountRate }` 供 tier_discount 动作折让。
 *
 * 每次结算都查表（等级随成长值外部变化，勿用缓存）。
 */
export const tierEligibleCondition = new PromotionCondition({
    code: 'tier_eligible',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '会员等级门槛' },
        { languageCode: LanguageCode.en, value: 'Member Tier Eligibility' },
    ],
    args: {
        minLevel: {
            type: 'int',
            defaultValue: 2,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '最低档位' },
                { languageCode: LanguageCode.en, value: 'Min tier level' },
            ],
        },
    },
    init(injector) {
        memberTierLookup.init(injector);
    },
    async check(ctx: RequestContext, order: any, args) {
        const customerId = order?.customer?.id;
        if (customerId == null) return false;
        const tier = await memberTierLookup.tierForCustomer(ctx, customerId);
        if (tier.tierLevel < (args.minLevel ?? 2)) return false;
        return {
            tierLevel: tier.tierLevel,
            specialDiscountRate: tier.specialDiscountRate ?? 0,
        };
    },
});