"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const bill_pay_coupon_recovery_1 = require("./bill-pay-coupon-recovery");
(0, vitest_1.describe)('resolveCouponRecoveryAction', () => {
    (0, vitest_1.it)('已支付及之后的状态：重试核销', () => {
        for (const status of ['PAID', 'IN_SERVICE', 'COMPLETED', 'SETTLED']) {
            (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)(status)).toBe('REDEEM');
        }
    });
    (0, vitest_1.it)('已取消/已退款：释放残留预占', () => {
        (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)('CANCELLED')).toBe('RELEASE');
        (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)('REFUNDED')).toBe('RELEASE');
    });
    (0, vitest_1.it)('订单不存在（预占单号查无此单）：释放残留预占', () => {
        (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)(null)).toBe('RELEASE');
        (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)(undefined)).toBe('RELEASE');
        (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)('')).toBe('RELEASE');
    });
    (0, vitest_1.it)('待报价/已报价：客户仍可继续支付，保持预占', () => {
        (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)('PENDING_QUOTE')).toBe('SKIP');
        (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)('QUOTED')).toBe('SKIP');
    });
    (0, vitest_1.it)('未知状态：保守跳过，交由人工核对', () => {
        (0, vitest_1.expect)((0, bill_pay_coupon_recovery_1.resolveCouponRecoveryAction)('SOMETHING_ELSE')).toBe('SKIP');
    });
});
//# sourceMappingURL=bill-pay-coupon-recovery.spec.js.map