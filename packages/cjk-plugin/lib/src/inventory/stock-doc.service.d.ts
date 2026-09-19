import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { StockLedgerService } from '@vendure/inventory-plugin';
import { StockDocEntity, StockDocType } from './stock-doc.entity';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
import { InventoryModeService } from './inventory-mode.service';
export interface StockDocItemInput {
    variantId: ID;
    fromStockLocationId?: ID;
    toStockLocationId?: ID;
    qty: number;
    realQty?: number;
    costPrice?: number;
}
export interface StockDocCreateInput {
    type: StockDocType;
    remark?: string;
    operator?: string;
    items: StockDocItemInput[];
}
export declare class StockDocService {
    private conn;
    private virtualPhysicalStockService;
    private stockLedgerService;
    private inventoryModeService;
    constructor(conn: TransactionalConnection, virtualPhysicalStockService: VirtualPhysicalStockService, stockLedgerService: StockLedgerService, inventoryModeService: InventoryModeService);
    /** inventoryMode gate 委托独立服务：odoo 模式只读，禁止直接落库 */
    private assertSimple;
    /** 生成租户内唯一单号（前缀+时间戳+随机，冲突重试） */
    nextCode(ctx: RequestContext, type: StockDocType): Promise<string>;
    /** 直接生效：PURCHASE 加目标仓、TRANSFER 源-目标+、STOCKTAKE 按 realQty 覆盖 */
    create(ctx: RequestContext, input: StockDocCreateInput): Promise<StockDocEntity>;
    private applyMovement;
    /** 流水查询：按当前渠道查 OrderStockLedger（关联 variant/location/bizCode/orderLine），供流水页用 */
    ledger(ctx: RequestContext, options?: {
        productVariantId?: ID;
        locationId?: ID;
        bizCode?: string;
        orderLineId?: ID;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: any[];
        totalItems: number;
    }>;
}
