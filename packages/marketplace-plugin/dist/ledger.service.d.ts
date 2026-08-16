import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { MarketplaceInventoryLedger } from './entities/marketplace-inventory-ledger.entity';
export interface LedgerRecordInput {
    variantId: ID;
    merchantChannelId: string;
    saleSource: string;
    stockBefore: number;
    stockAfter: number;
    stockDelta: number;
    actionType: string;
    orderId?: string | null;
    validFrom?: Date;
}
export interface LedgerQueryOptions {
    saleSource?: string;
    actionType?: string;
    from?: Date;
    to?: Date;
    orderId?: string;
}
/**
 * @description
 * 供销存中间表服务：负责写入与查询 `MarketplaceInventoryLedger` 记录。
 * 供 Task10 对账使用，可按商家、销售来源、时间范围等维度聚合查询。
 */
export declare class LedgerService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 写入一条 ledger 记录 */
    recordChange(ctx: RequestContext, input: LedgerRecordInput): Promise<MarketplaceInventoryLedger>;
    /** 按 merchantChannelId 聚合查询 */
    queryByMerchant(ctx: RequestContext, merchantChannelId: string, options?: LedgerQueryOptions): Promise<MarketplaceInventoryLedger[]>;
    /** 按销售来源查询 */
    queryBySaleSource(ctx: RequestContext, saleSource: string, options?: LedgerQueryOptions): Promise<MarketplaceInventoryLedger[]>;
    /** 按时间范围查询（对账用） */
    queryByDateRange(ctx: RequestContext, from: Date, to: Date, options?: LedgerQueryOptions): Promise<MarketplaceInventoryLedger[]>;
    private applyCommonFilters;
}
