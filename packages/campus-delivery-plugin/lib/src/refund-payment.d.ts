import { ID, Payment, RequestContext, TransactionalConnection } from '@vendure/core';
/** 可退款支付状态：只认已成功支付（Declined/Error/Cancelled 的重试单不可退） */
export declare const REFUNDABLE_PAYMENT_STATES: string[];
export interface RefundablePayment {
    payment: Payment;
    refunded: number;
    remaining: number;
}
/** 单支付单已退总额（排除 Failed：结算失败的单并未真实打款） */
export declare function refundedTotal(connection: TransactionalConnection, paymentId: number | string): Promise<number>;
/**
 * 结算退款：refundOrder 只创建 Pending 退款单，settleRefund 才真实打款。
 * 结算失败必须把退款单置 Failed（保留审计痕迹），否则该单仍计入已退总额：
 * 商家重试拒单/异常全额退款时会判定「无可退余额」，直接取消订单而不退款（客户静默少退）。
 */
export declare function settleRefundOrMarkFailed(connection: TransactionalConnection, orderService: {
    settleRefund: (ctx: RequestContext, input: {
        id: ID;
    }) => Promise<unknown>;
}, ctx: RequestContext, refundId: ID): Promise<void>;
/**
 * 订单可退支付单（新→旧）：仅 Settled/Authorized，且仍有未退余额。
 * 统一商家拒单 / T4 / 异常处置 / 改址退款的支付单选择口径，避免选中失败重试单导致退款失败。
 */
export declare function refundablePayments(connection: TransactionalConnection, orderId: number | string): Promise<RefundablePayment[]>;
/** 选一张可退支付单：needAmount 为空取最新可退单；否则要求单张余额足够 */
export declare function pickRefundablePayment(connection: TransactionalConnection, orderId: number | string, needAmount?: number): Promise<RefundablePayment | null>;
