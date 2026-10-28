"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCouponRecoveryAction = resolveCouponRecoveryAction;
const REDEEM_STATUSES = ['PAID', 'IN_SERVICE', 'COMPLETED', 'SETTLED'];
const RELEASE_STATUSES = ['CANCELLED', 'REFUNDED'];
function resolveCouponRecoveryAction(orderStatus) {
    if (!orderStatus) {
        return 'RELEASE';
    }
    if (REDEEM_STATUSES.includes(orderStatus)) {
        return 'REDEEM';
    }
    if (RELEASE_STATUSES.includes(orderStatus)) {
        return 'RELEASE';
    }
    return 'SKIP';
}
//# sourceMappingURL=bill-pay-coupon-recovery.js.map