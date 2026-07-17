import { LanguageCode, PromotionOrderAction } from '@vendure/core';

import { CouponService } from './coupon.service';

/**
 * 优惠券订单级折扣 Action。
 *
 * 桥接 coupon-plugin 折扣到 Vendure Promotion 系统：
 * 读取 order.customFields.appliedCouponCode，调用 CouponService.validateCoupon
 * 计算折扣金额，返回负数作为 OrderAdjustment。
 *
 * 使用方式：管理员在后台创建一条 Promotion，选中 "coupon_discount" action，
 * 无需配置 args。该 Promotion 会自动对所有带有 appliedCouponCode 的订单生效。
 *
 * service 引用由 CouponPlugin.onApplicationBootstrap 注入（模块级单例）。
 */
let couponServiceRef: CouponService | null = null;

export function setCouponServiceRef(ref: CouponService): void {
    couponServiceRef = ref;
}

export const couponOrderAction = new PromotionOrderAction({
    code: 'coupon_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '优惠券折扣（按订单已绑定的券码计算）' },
        { languageCode: LanguageCode.en, value: 'Coupon discount (by applied coupon code on order)' },
    ],
    args: {},
    async execute(ctx, order) {
        const code = (order as any).customFields?.appliedCouponCode;
        if (!code || !couponServiceRef) return 0;

        try {
            const orderLines = await couponServiceRef.getOrderLinesForCoupon(ctx, order.id);
            const result = await couponServiceRef.validateCoupon(ctx, code, orderLines);
            if (!result.valid || result.discountAmount <= 0) return 0;
            return -result.discountAmount;
        } catch {
            return 0;
        }
    },
});
