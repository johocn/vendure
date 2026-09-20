import { Connection } from 'typeorm';
import { ShiftSummary } from '../entities/pos-session.entity';
import { RefundService } from './refund.service';
/**
 * 交班对账服务：
 * - 聚合班次内所有 Order（通过 Order.customFields.posSessionId 关联）
 * - 按 orderType 分组统计（sale/refund/hold）
 * - 按 Payment.method 聚合支付明细（count + amount）
 * - 现金对账：expectedCash = openingFloat + Σ(cash payment amount)
 *   若 closingCash 与 expectedCash 差额 > 1 分则产生 warning
 *
 * 关键实现细节（Vendure 3.6.4）：
 * 1. Custom fields 是 embedded entity，列名形如 `customFields_posSessionId`
 *    不能用 `customFieldsJson ->> '$.posSessionId'` 的 JSON 查询
 * 2. Payment.amount 用 @Money 装饰器，单位为分（int）
 * 3. Order.total 为计算字段（subTotal + shipping），需 select 实体后访问 getter
 * 4. 退货 Order 的 total 为负数，统计 refundAmount 取 Math.abs
 */
export declare class ShiftReportService {
    private connection;
    private refundService;
    constructor(connection: Connection, refundService: RefundService);
    /**
     * 生成班次对账单。
     * @param sessionId 班次 ID
     * @param closingCash 实交现金（分），可选；传入则进行现金对账
     */
    generateSummary(sessionId: number, closingCash?: number): Promise<ShiftSummary>;
    /**
     * 计算应收现金 = openingFloat + Σ(method='cash' 且 state='Settled' 的 payment.amount)。
     * 退货 Order 的 cash payment 金额为负，会自动冲减。
     * 原生 Refund 中 method='cash' 且 state='Settled' 的退款也需冲减。
     */
    private calculateExpectedCash;
    /**
     * 查询班次内所有 Order（含 payments 关系）。
     *
     * TypeORM 对 embedded custom field 列名的解析在不同测试环境下不稳定
     * （dot notation 'ord.customFields.posSessionId' 在部分环境下被错误解析为
     * 'customFieldsPossessionid'）。此处用 PRAGMA 动态查找实际列名后查询。
     */
    private queryOrdersBySession;
}
