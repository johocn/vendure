import { ID, ListQueryBuilder, RequestContext, TransactionalConnection } from '@vendure/core';
import { OrderStockLedger } from './entities/order-stock-ledger.entity';
export type LedgerBizType = 'order' | 'afterSales' | 'stockIn' | 'stockOut' | 'stockMove' | 'stocktake' | 'manual';
export interface StockLedgerInput {
    productVariantId: ID;
    stockLocationId: ID;
    bizType: LedgerBizType;
    bizCode?: string;
    orderLineId?: ID;
    /** 默认按 delta 符号推导：>=0 => in，<0 => out */
    direction?: 'in' | 'out';
    quantity: number;
    beforeOnHand?: number;
    afterOnHand?: number;
    otherLocationId?: ID;
    reason?: string;
}
export declare class StockLedgerService {
    private connection;
    private listQueryBuilder;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    /**
     * 写一条账本流水（沿用与业务一致的 ctx，若处于事务中则写入同一事务）。
     */
    record(ctx: RequestContext, input: StockLedgerInput): Promise<OrderStockLedger>;
    list(ctx: RequestContext, options?: {
        productVariantId?: ID;
        locationId?: ID;
        bizType?: string;
        bizCode?: string;
        orderLineId?: ID;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: OrderStockLedger[];
        totalItems: number;
    }>;
    private generateCode;
}
