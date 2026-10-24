import { Payment, TransactionalConnection } from '@vendure/core';
/** 可退款支付状态：只认已成功支付（Declined/Error/Cancelled 的重试单不可退） */
export declare const REFUNDABLE_PAYMENT_STATES: string[];
export interface RefundablePayment {
    payment: Payment;
    refunded: number;
    remaining: number;
}
/** 单支付单已退总额 */
export declare function refundedTotal(connection: TransactionalConnection, paymentId: number | string): Promise<number>;
/**
 * 订单可退支付单（新→旧）：仅 Settled/Authorized，且仍有未退余额。
 * 统一商家拒单 / T4 / 异常处置 / 改址退款的支付单选择口径，避免选中失败重试单导致退款失败。
 */
export declare function refundablePayments(connection: TransactionalConnection, orderId: number | string): Promise<RefundablePayment[]>;
/** 选一张可退支付单：needAmount 为空取最新可退单；否则要求单张余额足够 */
export declare function pickRefundablePayment(connection: TransactionalConnection, orderId: number | string, needAmount?: number): Promise<RefundablePayment | null>;
