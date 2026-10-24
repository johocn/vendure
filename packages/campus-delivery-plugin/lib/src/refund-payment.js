"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFUNDABLE_PAYMENT_STATES = void 0;
exports.refundedTotal = refundedTotal;
exports.refundablePayments = refundablePayments;
exports.pickRefundablePayment = pickRefundablePayment;
const core_1 = require("@vendure/core");
/** 可退款支付状态：只认已成功支付（Declined/Error/Cancelled 的重试单不可退） */
exports.REFUNDABLE_PAYMENT_STATES = ['Settled', 'Authorized'];
/** 单支付单已退总额 */
async function refundedTotal(connection, paymentId) {
    var _a;
    const refunded = await connection.rawConnection
        .getRepository(core_1.Refund)
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.total), 0)', 'sum')
        .where('r."paymentId" = :pid', { pid: paymentId })
        .getRawOne();
    return Number((_a = refunded === null || refunded === void 0 ? void 0 : refunded.sum) !== null && _a !== void 0 ? _a : 0);
}
/**
 * 订单可退支付单（新→旧）：仅 Settled/Authorized，且仍有未退余额。
 * 统一商家拒单 / T4 / 异常处置 / 改址退款的支付单选择口径，避免选中失败重试单导致退款失败。
 */
async function refundablePayments(connection, orderId) {
    const payments = await connection.rawConnection.getRepository(core_1.Payment).find({
        where: { order: { id: orderId } },
        order: { id: 'DESC' },
    });
    const out = [];
    for (const payment of payments) {
        if (!exports.REFUNDABLE_PAYMENT_STATES.includes(String(payment.state)))
            continue;
        const refunded = await refundedTotal(connection, payment.id);
        const remaining = Number(payment.amount) - refunded;
        if (remaining > 0)
            out.push({ payment, refunded, remaining });
    }
    return out;
}
/** 选一张可退支付单：needAmount 为空取最新可退单；否则要求单张余额足够 */
async function pickRefundablePayment(connection, orderId, needAmount) {
    var _a, _b;
    const list = await refundablePayments(connection, orderId);
    if (needAmount == null)
        return (_a = list[0]) !== null && _a !== void 0 ? _a : null;
    return (_b = list.find(p => p.remaining >= needAmount)) !== null && _b !== void 0 ? _b : null;
}
//# sourceMappingURL=refund-payment.js.map