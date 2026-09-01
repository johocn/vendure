"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponAppliedCondition = void 0;
const core_1 = require("@vendure/core");
const coupon_runtime_1 = require("./coupon-runtime");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
/**
 * 券结算条件：读取 order.customFields.couponCode，
 * 校验券仍有效（UNUSED/模板 enabled/未过期/门槛满足）后，
 * 计算出一个正的 discountAmount（作为 state 传给配套 action）。
 *
 * 返回 state `{ discountAmount }` 表示条件成立，并让 action 直接复用折扣额。
 */
exports.couponAppliedCondition = new core_1.PromotionCondition({
    code: 'coupon_applied',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '订单使用了有效优惠券' },
        { languageCode: core_1.LanguageCode.en, value: 'Order has an active coupon applied' },
    ],
    args: {},
    async check(ctx, order, _args) {
        var _a;
        const code = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.couponCode;
        if (!code)
            return false;
        const coupon = await (0, coupon_runtime_1.getCouponConnection)()
            .getRepository(ctx, customer_coupon_entity_1.CustomerCoupon)
            .findOne({ where: { code }, relations: { template: true } });
        if (!(coupon === null || coupon === void 0 ? void 0 : coupon.template))
            return false;
        const template = coupon.template;
        const now = new Date();
        // UNUSED / RETURNED（取消回退后可复用）都视为可结算
        if (coupon.status !== 'UNUSED' && coupon.status !== 'RETURNED')
            return false;
        if (!template.enabled)
            return false;
        if (template.startsAt && now < template.startsAt)
            return false;
        if (template.endsAt && now > template.endsAt)
            return false;
        const pricesIncludeTax = ctx.channel.pricesIncludeTax;
        const base = pricesIncludeTax ? order.subTotalWithTax : order.subTotal;
        if (template.minSpend > base)
            return false;
        const upperBound = pricesIncludeTax ? order.subTotalWithTax : order.subTotal;
        let discountAmount;
        if (template.type === 'PERCENT') {
            // discountValue 为折数（8.5折=85），折扣 = (100-85)% = 15%
            const rate = (100 - template.discountValue) / 100;
            discountAmount = Math.round(upperBound * rate);
        }
        else if (template.type === 'FREE_SHIPPING') {
            // 免邮券：折扣额 = 符合条件的配送线小计；无配送线则 0
            // Vendure 3.x 的 ShippingLine 用 price/priceWithTax 表达配送金额（无 shippingPrice 字段）
            discountAmount = (order.shippingLines || [])
                .filter((l) => { var _a, _b; return ((_b = (_a = l.customFields) === null || _a === void 0 ? void 0 : _a.eligibleForCoupon) !== null && _b !== void 0 ? _b : true); })
                .reduce((s, l) => s + (pricesIncludeTax ? l.priceWithTax : l.price), 0);
        }
        else {
            // FIXED / FULL：直减 discountValue，且不超过订单小计
            discountAmount = Math.max(0, Math.min(template.discountValue, upperBound));
        }
        return { discountAmount };
    },
});
//# sourceMappingURL=coupon-promotion-condition.js.map