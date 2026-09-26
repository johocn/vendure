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
    /** 盘点任务反查（D44）：仅盘点任务过账生成的单据有值，手工调数单为 null */
    taskId?: string | null;
    taskCode?: string | null;
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
    /**
     * 作业员明细聚合（D46）：按操作人合计「人手执行的库存单据」的单据数与件数。
     * 为什么放在服务端：原先前端取 `listDocs({ pageSize: 100 })` 再在浏览器里过滤 + 聚合，而
     * `clampPageSize` 把 pageSize 硬顶在 100 → 窗口内单据超过 100 条时，按 createdAt DESC 截掉的
     * 是**较老**单据，低频作业员会整行消失、合计系统性偏低。SQL 侧聚合后返回行数 = 操作人数，天然无上限。
     * 口径（与前端 `ops-report` 一致，避免两处各写一套）：排除 `STOCKTAKE` —— 真盘库过账单的人工作业量
     * 已由 `stocktakeStats(taskId)` 的盘次/应盘行口径覆盖；D42 起「库存明细页调整」产生的手工调数单
     * 复用该类型，属数据修正而非作业量。
     * count 用 `COUNT(DISTINCT d.id)`：left join 明细后行数会按明细条数膨胀；**无明细的单据仍计 1 单**
     * （与旧前端口径一致：旧实现按单据逐条累加，totalQty 取明细合计、缺失按 0）。
     * operator 用 COALESCE 折成空串：空串即「未记录操作人」，前端渲染为「未记录」占位，且排序时自然排在最前。
     */
    operatorStats(ctx: RequestContext, options?: {
        from?: string;
        to?: string;
    }): Promise<Array<{
        operator: string;
        count: number;
        qty: number;
    }>>;
}
