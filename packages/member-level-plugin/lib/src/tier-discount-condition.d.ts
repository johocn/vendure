import { LanguageCode, PromotionCondition } from '@vendure/core';
/**
 * 会员等级门槛条件：读订单顾客当前档位，>= minLevel（channel 配置 freeShippingLevel 之外的促销专用门槛，
 * 以 args.minLevel 为准）即通过，返回 state `{ tierLevel, specialDiscountRate }` 供 tier_discount 动作折让。
 *
 * 每次结算都查表（等级随成长值外部变化，勿用缓存）。
 */
export declare const tierEligibleCondition: PromotionCondition<{
    minLevel: {
        type: "int";
        defaultValue: number;
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        })[];
    };
}, "tier_eligible", false | {
    tierLevel: number;
    specialDiscountRate: number;
}>;
