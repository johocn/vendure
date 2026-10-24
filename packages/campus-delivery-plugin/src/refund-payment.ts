import { Payment, Refund, TransactionalConnection } from '@vendure/core';

/** 可退款支付状态：只认已成功支付（Declined/Error/Cancelled 的重试单不可退） */
export const REFUNDABLE_PAYMENT_STATES = ['Settled', 'Authorized'];

export interface RefundablePayment {
    payment: Payment;
    refunded: number;
    remaining: number;
}

/** 单支付单已退总额 */
export async function refundedTotal(connection: TransactionalConnection, paymentId: number | string): Promise<number> {
    const refunded = await connection.rawConnection
        .getRepository(Refund)
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.total), 0)', 'sum')
        .where('r."paymentId" = :pid', { pid: paymentId })
        .getRawOne();
    return Number(refunded?.sum ?? 0);
}

/**
 * 订单可退支付单（新→旧）：仅 Settled/Authorized，且仍有未退余额。
 * 统一商家拒单 / T4 / 异常处置 / 改址退款的支付单选择口径，避免选中失败重试单导致退款失败。
 */
export async function refundablePayments(
    connection: TransactionalConnection,
    orderId: number | string,
): Promise<RefundablePayment[]> {
    const payments = await connection.rawConnection.getRepository(Payment).find({
        where: { order: { id: orderId } } as any,
        order: { id: 'DESC' } as any,
    });
    const out: RefundablePayment[] = [];
    for (const payment of payments) {
        if (!REFUNDABLE_PAYMENT_STATES.includes(String(payment.state))) continue;
        const refunded = await refundedTotal(connection, payment.id);
        const remaining = Number(payment.amount) - refunded;
        if (remaining > 0) out.push({ payment, refunded, remaining });
    }
    return out;
}

/** 选一张可退支付单：needAmount 为空取最新可退单；否则要求单张余额足够 */
export async function pickRefundablePayment(
    connection: TransactionalConnection,
    orderId: number | string,
    needAmount?: number,
): Promise<RefundablePayment | null> {
    const list = await refundablePayments(connection, orderId);
    if (needAmount == null) return list[0] ?? null;
    return list.find(p => p.remaining >= needAmount) ?? null;
}
