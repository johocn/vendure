import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
/**
 * 对账口径：商家 Channel.customFields.settlementBasis
 * - 'paid'      已支付：PaymentSettled / PaymentAuthorized
 * - 'completed' 已完成：Delivered / Shipped（Vendure 默认订单状态机中不存在 'Completed'/'Fulfilled'，
 *                以最接近的终态 Delivered 及 Shipped 作为“已完成”口径）
 */
export type SettlementBasis = 'paid' | 'completed';
export interface MerchantSettlementEntry {
    orderId: ID;
    orderCode: string;
    state: string;
    totalWithTax: number;
    currencyCode: string;
    orderPlacedAt: Date | undefined;
    merchantChannelId: ID;
}
export declare class SettlementService {
    private connection;
    constructor(connection: TransactionalConnection);
    private getMerchantChannel;
    private getStatesForBasis;
    private buildQueryBuilder;
    /**
     * 对账：按 saleSource=marketplace 汇总指定商家 Channel 的订单，
     * 依据 settlementBasis（paid/completed）过滤订单状态。
     */
    exportMerchantSettlement(ctx: RequestContext, merchantChannelId: ID, from?: Date, to?: Date): Promise<MerchantSettlementEntry[]>;
    /** 商家订单查询（含对账状态过滤所需的基础信息） */
    listMerchantOrders(ctx: RequestContext, merchantChannelId: ID, from?: Date, to?: Date): Promise<Order[]>;
}
