import { LanguageCode, PromotionCondition, RequestContext } from '@vendure/core';

import { getCouponConnection } from './coupon-runtime';
import { CustomerCoupon } from './customer-coupon.entity';

/**
 * 券结算条件：读取 order.customFields.couponCode，
 * 校验券仍有效（UNUSED/模板 enabled/未过期/门槛满足）后，
 * 计算出一个正的 discountAmount（作为 state 传给配套 action）。
 *
 * 返回 state `{ discountAmount }` 表示条件成立，并让 action 直接复用折扣额。
 */
export const couponAppliedCondition = new PromotionCondition({
    code: 'coupon_applied',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '订单使用了有效优惠券' },
        { languageCode: LanguageCode.en, value: 'Order has an active coupon applied' },
    ],
    args: {},
    async check(ctx: RequestContext, order: any, _args) {
        const code = order?.customFields?.couponCode;
        if (!code) return false;

        const coupon = await getCouponConnection()
            .getRepository(ctx, CustomerCoupon)
            .findOne({ where: { code } as any, relations: { template: true } });
        if (!coupon?.template) return false;

        const template = coupon.template;
        const now = new Date();
        // UNUSED / RETURNED（取消回退后可复用）都视为可结算
        if (coupon.status !== 'UNUSED' && coupon.status !== 'RETURNED') return false;
        if (!template.enabled) return false;
        if (template.startsAt && now < template.startsAt) return false;
        if (template.endsAt && now > template.endsAt) return false;

        const pricesIncludeTax = ctx.channel.pricesIncludeTax;
        const base = pricesIncludeTax ? order.subTotalWithTax : order.subTotal;
        if (template.minSpend > base) return false;

        const upperBound = pricesIncludeTax ? order.subTotalWithTax : order.subTotal;
        let discountAmount: number;
        if (template.type === 'PERCENT') {
            // discountValue 为折数（8.5折=85），折扣 = (100-85)% = 15%
            const rate = (100 - template.discountValue) / 100;
            discountAmount = Math.round(upperBound * rate);
        } else if (template.type === 'FREE_SHIPPING') {
            // 免邮券：折扣额 = 符合条件的配送线小计；无配送线则 0
            // Vendure 3.x 的 ShippingLine 用 price/priceWithTax 表达配送金额（无 shippingPrice 字段）
            discountAmount = (order.shippingLines || [])
                .filter((l: any) => (l.customFields?.eligibleForCoupon ?? true))
                .reduce(
                    (s: number, l: any) => s + (pricesIncludeTax ? l.priceWithTax : l.price),
                    0,
                );
        } else {
            // FIXED / FULL：直减 discountValue，且不超过订单小计
            discountAmount = Math.max(0, Math.min(template.discountValue, upperBound));
        }
        return { discountAmount };
    },
});