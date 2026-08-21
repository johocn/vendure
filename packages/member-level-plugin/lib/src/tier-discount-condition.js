"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tierEligibleCondition = void 0;
const core_1 = require("@vendure/core");
const tier_lookup_1 = require("./tier-lookup");
/**
 * 会员等级门槛条件：读订单顾客当前档位，>= minLevel（channel 配置 freeShippingLevel 之外的促销专用门槛，
 * 以 args.minLevel 为准）即通过，返回 state `{ tierLevel, specialDiscountRate }` 供 tier_discount 动作折让。
 *
 * 每次结算都查表（等级随成长值外部变化，勿用缓存）。
 */
exports.tierEligibleCondition = new core_1.PromotionCondition({
    code: 'tier_eligible',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '会员等级门槛' },
        { languageCode: core_1.LanguageCode.en, value: 'Member Tier Eligibility' },
    ],
    args: {
        minLevel: {
            type: 'int',
            defaultValue: 2,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '最低档位' },
                { languageCode: core_1.LanguageCode.en, value: 'Min tier level' },
            ],
        },
    },
    init(injector) {
        tier_lookup_1.memberTierLookup.init(injector);
    },
    async check(ctx, order, args) {
        var _a, _b, _c;
        const customerId = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.id;
        if (customerId == null)
            return false;
        const tier = await tier_lookup_1.memberTierLookup.tierForCustomer(ctx, customerId);
        if (tier.tierLevel < ((_b = args.minLevel) !== null && _b !== void 0 ? _b : 2))
            return false;
        return {
            tierLevel: tier.tierLevel,
            specialDiscountRate: (_c = tier.specialDiscountRate) !== null && _c !== void 0 ? _c : 0,
        };
    },
});
//# sourceMappingURL=tier-discount-condition.js.map