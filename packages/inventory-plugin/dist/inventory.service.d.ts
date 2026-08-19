import { ID } from '@vendure/common/lib/shared-types';
import { RequestContext, Sale, StockLevel, StockLevelService, StockLocationService, StockMovementService, StockLocation, TransactionalConnection } from '@vendure/core';
import { StockInOrder } from './entities/stock-in-order.entity';
import { StockOutOrder } from './entities/stock-out-order.entity';
import { StockMoveOrder } from './entities/stock-move-order.entity';
import { StocktakeOrder } from './entities/stocktake-order.entity';
import { StockLedgerService, LedgerBizType } from './stock-ledger.service';
/** 账本元信息（写入 adjustStockForLocation 时可选传入，用于在仓库/门店维度落供销存账本）。 */
export interface LedgerMeta {
    bizType: LedgerBizType;
    bizCode?: string;
    orderLineId?: ID;
    otherLocationId?: ID;
}
export declare class InventoryService {
    private connection;
    private stockMovementService;
    private stockLevelService;
    private stockLocationService;
    private stockLedgerService;
    constructor(connection: TransactionalConnection, stockMovementService: StockMovementService, stockLevelService: StockLevelService, stockLocationService: StockLocationService, stockLedgerService: StockLedgerService);
    /**
     * 调整某仓库的库存（delta 为正数表示增加，负数表示减少）
     * 通过 adjustProductVariantStock 写入 StockAdjustment 流水
     * 在 customFields.businessReason 记录业务来源（无需二次查询）
     */
    protected adjustStockForLocation(ctx: RequestContext, variantId: ID, locationId: ID, delta: number, reason: string, meta?: LedgerMeta): Promise<void>;
    /**
     * 手工校准某仓可变体库存为指定绝对数量（delta = 目标 - 当前，写 manual 账本便于追溯）。
     * delta 为 0 时不写任何流水。
     */
    setStockForVariant(ctx: RequestContext, variantId: ID, locationId: ID, stockOnHand: number, reason?: string): Promise<void>;
    /**
     * 售后退货回补：将收到的退货回补到原发货仓，同一事务内写 afterSales 账本。
     * 供 after-sales-plugin 在 confirmReceive（Returning→Received）时调用。
     * @param quantity 正数表示回补数量（= min(订单行数量, 实收数量)）
     */
    applyAfterSalesRestock(ctx: RequestContext, variantId: ID, locationId: ID, quantity: number, afterSalesCode: string, orderLineId?: ID): Promise<void>;
    /**
     * 订单发货记账：core 在 Fulfillment Created→Pending 时创建 Sale 流水（真实扣减 onHand），
     * 本方法在同一事务内为该批 Sale 写入 order:out 账本，保证账实一致（账本口径铁律：只记真实 onHand 变动，
     * 占货 ALLOCATION 不记、超时取消 RELEASE 不记）。
     * 由 inventory.plugin.ts 注册的 StockMovementEvent(SALE) 阻塞事件处理器调用。
     */
    recordOrderSalesOut(ctx: RequestContext, sales: Sale[]): Promise<void>;
    /**
     * 校验源仓库存是否充足（available = stockOnHand - stockAllocated）
     */
    protected assertSufficientStock(ctx: RequestContext, variantId: ID, locationId: ID, requiredQty: number): Promise<void>;
    /**
     * 状态转换校验
     */
    protected assertTransition<S extends string>(order: {
        state: S;
    }, fromState: S, toState: S, transitions: Record<S, S[]>): void;
    /**
     * 生成业务单号（前缀 + 时间戳 + 随机数）
     */
    protected generateCode(prefix: string): string;
    findStockLevels(ctx: RequestContext, options?: {
        locationId?: ID;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: StockLevel[];
        totalItems: number;
    }>;
    findStockMovements(ctx: RequestContext, options?: {
        productVariantId?: ID;
        locationId?: ID;
        type?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: any[];
        totalItems: number;
    }>;
    findStockLocations(ctx: RequestContext, options?: {
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: StockLocation[];
        totalItems: number;
    }>;
    findStockLedger(ctx: RequestContext, options?: {
        productVariantId?: ID;
        locationId?: ID;
        bizType?: string;
        bizCode?: string;
        orderLineId?: ID;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: any[];
        totalItems: number;
    }>;
    /**
     * 多库库存展示（就近门店库存）：返回某商品在各仓库/门店的逐仓可售库存 + 距离。
     * - productId 必填；variantId 省略时返回该商品全部 variant。
     * - 带 lat/lng 时按距离升序排序（无坐标为 -1 排末尾）；带 city 时仅保留服务该城市的仓。
     */
    findNearbyStock(ctx: RequestContext, options: {
        productId: ID;
        variantId?: ID;
        lat?: number;
        lng?: number;
        city?: string;
    }): Promise<Array<{
        location: StockLocation;
        distanceKm: number;
        variants: Array<{
            variantId: ID;
            variantName: string;
            sku: string;
            stockOnHand: number;
            stockAllocated: number;
            stockAvailable: number;
        }>;
    }>>;
    private locationServesCity;
    private locationDistanceKm;
    private haversineKm;
    createStockInOrder(ctx: RequestContext, input: {
        type?: string;
        note?: string;
        targetLocationId: ID;
        lines: Array<{
            productVariantId: ID;
            quantity: number;
            unitPrice?: number;
        }>;
    }): Promise<StockInOrder>;
    findStockInOrders(ctx: RequestContext, options?: {
        state?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: StockInOrder[];
        totalItems: number;
    }>;
    findOneStockInOrder(ctx: RequestContext, id: ID): Promise<StockInOrder | null>;
    completeStockInOrder(ctx: RequestContext, id: ID): Promise<StockInOrder>;
    cancelStockInOrder(ctx: RequestContext, id: ID): Promise<StockInOrder>;
    createStockOutOrder(ctx: RequestContext, input: {
        type?: string;
        note?: string;
        sourceLocationId: ID;
        lines: Array<{
            productVariantId: ID;
            quantity: number;
            unitPrice?: number;
        }>;
    }): Promise<StockOutOrder>;
    findStockOutOrders(ctx: RequestContext, options?: {
        state?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: StockOutOrder[];
        totalItems: number;
    }>;
    findOneStockOutOrder(ctx: RequestContext, id: ID): Promise<StockOutOrder | null>;
    completeStockOutOrder(ctx: RequestContext, id: ID): Promise<StockOutOrder>;
    cancelStockOutOrder(ctx: RequestContext, id: ID): Promise<StockOutOrder>;
    createStockMoveOrder(ctx: RequestContext, input: {
        note?: string;
        sourceLocationId: ID;
        targetLocationId: ID;
        lines: Array<{
            productVariantId: ID;
            quantity: number;
        }>;
    }): Promise<StockMoveOrder>;
    findStockMoveOrders(ctx: RequestContext, options?: {
        state?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: StockMoveOrder[];
        totalItems: number;
    }>;
    findOneStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder | null>;
    /**
     * Pending → InTransit：源仓出库（扣减）
     */
    shipStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder>;
    /**
     * InTransit → Received：目的仓入库（增加）
     */
    receiveStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder>;
    /**
     * Received → Completed：仅状态变更
     */
    completeStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder>;
    /**
     * Pending/InTransit → Cancelled
     * - Pending 态：无库存操作
     * - InTransit 态：回滚源仓（加回去）
     */
    cancelStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder>;
    createStocktakeOrder(ctx: RequestContext, input: {
        note?: string;
        locationId: ID;
        productVariantIds: ID[];
    }): Promise<StocktakeOrder>;
    findStocktakeOrders(ctx: RequestContext, options?: {
        state?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: StocktakeOrder[];
        totalItems: number;
    }>;
    findOneStocktakeOrder(ctx: RequestContext, id: ID): Promise<StocktakeOrder | null>;
    /**
     * Pending → Counting：快照 systemQuantity
     */
    startCountingStocktake(ctx: RequestContext, id: ID): Promise<StocktakeOrder>;
    /**
     * Counting → Reconciling：录入 countedQuantity，计算 difference
     */
    submitStocktakeCount(ctx: RequestContext, id: ID, counts: Array<{
        lineId: ID;
        countedQuantity: number;
    }>): Promise<StocktakeOrder>;
    /**
     * 审核单行（标记 reconciled = true）
     */
    reconcileStocktakeLine(ctx: RequestContext, orderId: ID, lineId: ID): Promise<StocktakeOrder>;
    /**
     * Reconciling → Completed：对每行 reconciled=true 的行应用差异调整
     */
    completeStocktakeOrder(ctx: RequestContext, id: ID): Promise<StocktakeOrder>;
    cancelStocktakeOrder(ctx: RequestContext, id: ID): Promise<StocktakeOrder>;
}
