import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { OrderStockLedger } from '@vendure/inventory-plugin';
import { StockDocEntity, StockDocType } from './stock-doc.entity';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
import { InventoryModeService } from './inventory-mode.service';
import { StorageBinService } from '../storage/storage-bin.service';
export interface StockDocItemInput {
    variantId: ID;
    fromStockLocationId?: ID;
    toStockLocationId?: ID;
    qty: number;
    realQty?: number;
    costPrice?: number;
    /** 库位归位（可选）：填写则入库后把该 SKU 归位到该库位 */
    binId?: ID;
    /** 库区归位（可选）：zone 档只填库区 */
    zoneId?: ID;
}
export interface StockDocCreateInput {
    type: StockDocType;
    remark?: string;
    operator?: string;
    items: StockDocItemInput[];
}
/** 流水查询入参（与 GraphQL `stockMovementLedger` 一一对应；新增项全部可选，向后兼容） */
export interface StockDocLedgerQuery {
    productVariantId?: ID;
    locationId?: ID;
    bizType?: string;
    bizCode?: string;
    orderLineId?: ID;
    /** 'in' | 'out'；其它值视为不传 */
    direction?: string;
    /** ISO 时间字符串；非法值视为不传 */
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}
export interface StockDocLedgerSummary {
    inQty: number;
    outQty: number;
}
export interface StockDocSummaryRow {
    id: string;
    code: string;
    type: string;
    remark: string | null;
    operator: string | null;
    createdAt: string;
    itemCount: number;
    totalQty: number;
}
export declare class StockDocService {
    private conn;
    private virtualPhysicalStockService;
    private inventoryModeService;
    private storageBinService;
    constructor(conn: TransactionalConnection, virtualPhysicalStockService: VirtualPhysicalStockService, inventoryModeService: InventoryModeService, storageBinService: StorageBinService);
    /** inventoryMode gate 委托独立服务：odoo 模式只读，禁止直接落库 */
    private assertSimple;
    /** 生成租户内唯一单号（前缀+时间戳+随机，冲突重试） */
    nextCode(ctx: RequestContext, type: StockDocType): Promise<string>;
    /** 直接生效：PURCHASE 加目标仓、TRANSFER 源-目标+、STOCKTAKE 按 realQty 覆盖 */
    create(ctx: RequestContext, input: StockDocCreateInput): Promise<StockDocEntity>;
    /**
     * 库位归位（可选）：仅在显式传了 binId / zoneId 时写入，
     * 不传 = 与改造前完全一致（向后兼容，现网无感）。
     */
    private applyBinBinding;
    private applyMovement;
    /**
     * 流水查询：按当前渠道查 OrderStockLedger。
     * 不复用 `@vendure/inventory-plugin` 的 `StockLedgerService.list()`（它不支持 direction/from/to/summary，
     * 且不宜改动另一个包的 src 与 lib），改为在本服务内自建 QueryBuilder。
     * 渠道 scoping 沿用既有写法（对齐 `pickup-location.service.ts:41` 的 innerJoin channels）。
     */
    ledger(ctx: RequestContext, options?: StockDocLedgerQuery): Promise<{
        items: OrderStockLedger[];
        totalItems: number;
        summary: StockDocLedgerSummary;
    }>;
    /** 单据中心列表：本租户单据（可按类型/仓库/日期/操作人过滤）+ 每单条数/总数量 */
    listDocs(ctx: RequestContext, options?: {
        type?: string;
        locationId?: ID;
        from?: string;
        to?: string;
        operator?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        totalItems: number;
        items: StockDocSummaryRow[];
    }>;
}
