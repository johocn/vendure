import { Refund, RequestContext } from '@vendure/core';
import { RefundService } from '../services/refund.service';
/**
 * 退货退款 API：
 * - createPosRefund: 对已完成订单创建退款（现金立即结算，聚合码标记人工退款）
 * - settleManualRefund: 手动结算待处理退款
 * - posRefunds: 查询班次内退款列表
 */
export declare class AdminRefundResolver {
    private refundService;
    constructor(refundService: RefundService);
    /**
     * 创建退货退款。
     * 需原单状态为 PaymentSettled 等已完成状态。
     */
    createPosRefund(input: {
        originalOrderId: string;
        paymentId: string;
        amount: number;
        reason?: string;
    }, ctx: RequestContext): Promise<Refund>;
    /**
     * 手动结算待处理退款（聚合码已结算的需人工处理）。
     */
    settleManualRefund(input: {
        refundId: string;
        transactionId: string;
    }, ctx: RequestContext): Promise<Refund>;
    /**
     * 查询班次内所有退款单。
     */
    posRefunds(sessionId: string): Promise<Refund[]>;
}
