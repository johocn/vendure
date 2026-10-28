/**
 * 买单券核销补偿判定（纯函数，便于单测）。
 *
 * 定时补偿扫描「仍是 UNUSED/RETURNED 且仍被某笔 BP- 单预占」的券，按对应买单当前状态决定动作：
 * - 已支付及之后（PAID/IN_SERVICE/COMPLETED/SETTLED）：重试核销（幂等，见 redeemCoupon）；
 * - 已取消/已退款或订单不存在：释放残留预占，避免券被永久锁死；
 * - 待报价/已报价（PENDING_QUOTE/QUOTED）：本人仍可继续支付，保持预占不动。
 */
export type CouponRecoveryAction = 'REDEEM' | 'RELEASE' | 'SKIP';

const REDEEM_STATUSES = ['PAID', 'IN_SERVICE', 'COMPLETED', 'SETTLED'];
const RELEASE_STATUSES = ['CANCELLED', 'REFUNDED'];

export function resolveCouponRecoveryAction(
    orderStatus: string | null | undefined,
): CouponRecoveryAction {
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
