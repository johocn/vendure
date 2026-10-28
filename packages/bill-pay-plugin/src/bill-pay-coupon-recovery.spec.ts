import { describe, expect, it } from 'vitest';

import { resolveCouponRecoveryAction } from './bill-pay-coupon-recovery';

describe('resolveCouponRecoveryAction', () => {
    it('已支付及之后的状态：重试核销', () => {
        for (const status of ['PAID', 'IN_SERVICE', 'COMPLETED', 'SETTLED']) {
            expect(resolveCouponRecoveryAction(status)).toBe('REDEEM');
        }
    });

    it('已取消/已退款：释放残留预占', () => {
        expect(resolveCouponRecoveryAction('CANCELLED')).toBe('RELEASE');
        expect(resolveCouponRecoveryAction('REFUNDED')).toBe('RELEASE');
    });

    it('订单不存在（预占单号查无此单）：释放残留预占', () => {
        expect(resolveCouponRecoveryAction(null)).toBe('RELEASE');
        expect(resolveCouponRecoveryAction(undefined)).toBe('RELEASE');
        expect(resolveCouponRecoveryAction('')).toBe('RELEASE');
    });

    it('待报价/已报价：客户仍可继续支付，保持预占', () => {
        expect(resolveCouponRecoveryAction('PENDING_QUOTE')).toBe('SKIP');
        expect(resolveCouponRecoveryAction('QUOTED')).toBe('SKIP');
    });

    it('未知状态：保守跳过，交由人工核对', () => {
        expect(resolveCouponRecoveryAction('SOMETHING_ELSE')).toBe('SKIP');
    });
});
