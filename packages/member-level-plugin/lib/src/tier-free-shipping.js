"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tierFreeShippingCalculator = exports.tierFreeShippingEligibilityChecker = void 0;
const core_1 = require("@vendure/core");
const tier_lookup_1 = require("./tier-lookup");
/**
 * 会员等级免运费门槛 checker。
 * 判定条件（写入 check，勿用 shouldRunCheck 缓存——等级随顾客成长值/渠道配置外部变化）：
 * 1. channel.freeShippingLevel > 0 才启用；否则不适用（返回 false）。
 * 2. 当前顾客档位 tierLevel >= channel.freeShippingLevel 即该方式适用。
 * 不适用（未启用 / 等级不足 / 无 customer）返回 false → 结算不展示该运费方式 → calculator 不执行。
 */
exports.tierFreeShippingEligibilityChecker = new core_1.ShippingEligibilityChecker({
    code: 'member-tier-free-shipping-eligibility',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '会员等级免运费门槛' },
        { languageCode: core_1.LanguageCode.en, value: 'Member Tier Free Shipping Eligibility' },
    ],
    args: {},
    init(injector) {
        tier_lookup_1.memberTierLookup.init(injector);
    },
    check: async (ctx, order) => {
        var _a, _b, _c, _d;
        const freeShippingLevel = (_c = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.freeShippingLevel) !== null && _c !== void 0 ? _c : 0;
        if (freeShippingLevel <= 0) {
            return false;
        }
        const customerId = (_d = order === null || order === void 0 ? void 0 : order.customer) === null || _d === void 0 ? void 0 : _d.id;
        if (customerId == null) {
            return false;
        }
        const tier = await tier_lookup_1.memberTierLookup.tierForCustomer(ctx, customerId);
        return tier.tierLevel >= freeShippingLevel;
    },
});
/**
 * 会员等级免运费 calculator：报价 0 元（含税）。
 * 仅当勾选该 calculator 的运费方式被选中（checker 通过）时计算，返回 0 即免运费。
 */
exports.tierFreeShippingCalculator = new core_1.ShippingCalculator({
    code: 'member-tier-free-shipping',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '会员等级免运费（0 元）' },
        { languageCode: core_1.LanguageCode.en, value: 'Member Tier Free Shipping' },
    ],
    args: {},
    calculate: async () => ({
        price: 0,
        priceIncludesTax: true,
        taxRate: 0,
        metadata: { freeShipping: true },
    }),
});
//# sourceMappingURL=tier-free-shipping.js.map