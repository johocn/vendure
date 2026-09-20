import { ID, OrderService, Refund, RequestContext, TransactionalConnection } from '@vendure/core';
import { Connection } from 'typeorm';
/**
 * 退货退款服务：
 * - createRefund: 调用 OrderService.refundOrder 创建 Refund
 *   - 现金支付：立即 settleRefund（当场退现金）
 *   - 聚合码支付：标记 metadata.needsManualRefund=true（需人工退款）
 * - settleManualRefund: 手动结算待处理退款（聚合码已结算的）
 *
 * 关键 API（Vendure 3.6.4）：
 * 1. OrderService.refundOrder(ctx, { paymentId, amount, reason }) → Refund
 *    要求 Order 状态为 PaymentSettled / PaymentAuthorized / Completed / PartiallyShipped 等
 * 2. OrderService.settleRefund(ctx, { id, transactionId }) → Refund (state=Settled)
 * 3. Refund.total 为负数（退款金额的负值），state: Pending → Settled | Failed
 */
export declare class RefundService {
    private connection;
    private transactionalConnection;
    private orderService;
    constructor(connection: Connection, transactionalConnection: TransactionalConnection, orderService: OrderService);
    /**
     * 创建退货退款。
     * @param input.originalOrderId 原销售单 ID
     * @param input.paymentId 原单上的 Payment ID（退款挂在哪个 Payment 上）
     * @param input.amount 退款金额（分，正数）
     * @param input.reason 退款原因
     */
    createRefund(ctx: RequestContext, input: {
        originalOrderId: ID;
        paymentId: ID;
        amount: number;
        reason?: string;
    }): Promise<Refund>;
    /**
     * 手动结算退货退款（聚合码已结算的需人工处理）。
     */
    settleManualRefund(ctx: RequestContext, input: {
        refundId: ID;
        transactionId: string;
    }): Promise<Refund>;
    /**
     * 查询班次内所有退款单（通过 Payment → Order → customFields.posSessionId）。
     * 返回的 Refund 已加载 payment 关系，供 GraphQL Refund.payment 解析。
     */
    findRefundsBySession(sessionId: number): Promise<Refund[]>;
}
