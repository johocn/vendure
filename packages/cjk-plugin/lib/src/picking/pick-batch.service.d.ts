import { FulfillmentService, ID, Order, OrderService, RequestContext, StockLocationService, TransactionalConnection } from '@vendure/core';
import { PickBatch, PickBatchState } from './pick-batch.entity';
import { PickBatchOrder } from './pick-batch-order.entity';
import { sortPickingRows, type WarehouseCandidate } from './pick-batch-math';
export interface PickBatchListOptions {
    page?: number;
    pageSize?: number;
    state?: PickBatchState | null;
    stockLocationId?: number | null;
}
/** 候选订单 / 批次成员共用的订单快照（前端直接消费，字段名与 apis/picking.ts 对齐） */
export interface PickOrderSnapshot {
    id: string;
    code: string;
    state: string;
    customerName: string | null;
    phoneNumber: string | null;
    province: string | null;
    city: string | null;
    streetLine1: string | null;
    streetLine2: string | null;
    postalCode: string | null;
    address: string;
    itemCount: number;
    recommendedStockLocationId: string | null;
    distanceKm: number | null;
    inBatchId: string | null;
    inBatchCode: string | null;
}
export declare class PickBatchService {
    private connection;
    private stockLocationService;
    private orderService;
    private fulfillmentService;
    constructor(connection: TransactionalConnection, stockLocationService: StockLocationService, orderService: OrderService, fulfillmentService: FulfillmentService);
    /** 该批次的渠道归属，所有读写都必须带 tenantChannelId 过滤 */
    private tenantOf;
    findAll(ctx: RequestContext, options: PickBatchListOptions): Promise<{
        items: PickBatch[];
        totalItems: number;
    }>;
    findOne(ctx: RequestContext, id: ID): Promise<PickBatch | null>;
    members(ctx: RequestContext, batchId: ID): Promise<PickBatchOrder[]>;
    /**
     * 同一订单不得同时存在于两个非终态批次中。
     * 命中时返回冲突批次号，供上层拼装明确原因。
     */
    findConflicts(ctx: RequestContext, orderIds: number[], excludeBatchId?: number): Promise<Map<number, {
        batchId: number;
        code: string;
    }>>;
    /** 生成当日下一个批次号 */
    nextCode(ctx: RequestContext, now?: Date): Promise<string>;
    create(ctx: RequestContext, input: {
        stockLocationId: number;
        orderIds: number[];
        note?: string | null;
    }, createdBy: string | null): Promise<PickBatch>;
    addOrders(ctx: RequestContext, batchId: ID, orderIds: number[]): Promise<PickBatch>;
    removeOrders(ctx: RequestContext, batchId: ID, orderIds: number[]): Promise<PickBatch>;
    advance(ctx: RequestContext, batchId: ID, to: PickBatchState): Promise<PickBatch>;
    cancel(ctx: RequestContext, batchId: ID): Promise<PickBatch>;
    /**
     * 拣货汇总：按 SKU 合并数量、收集涉及订单号，并按库位排序出拣货路径。
     * 三档共用：zone 档下 rowNo / levelNo 为 null，排序自动退化为按库区。
     * 用仓储 + JS 聚合实现（方言无关，sqlite / postgres 行为一致）。
     */
    pickingList(ctx: RequestContext, batchId: ID): Promise<ReturnType<typeof sortPickingRows>>;
    /** 候选订单的就近选仓推荐 */
    recommend(order: Order, warehouses: WarehouseCandidate[]): import("./pick-batch-math").Recommendation;
    /** 批次列表视图：补 SDL 要求的 memberCount / itemCount */
    private warehouseCandidates;
    /** 各批次成员数与件数 */
    counts(ctx: RequestContext, batchIds: number[]): Promise<Map<number, {
        memberCount: number;
        itemCount: number;
    }>>;
    /** 列表视图：批次字段 + memberCount / itemCount */
    findAllView(ctx: RequestContext, options: PickBatchListOptions): Promise<{
        totalItems: number;
        items: Record<string, unknown>[];
    }>;
    /** 详情视图：批次字段 + members（订单快照） */
    detail(ctx: RequestContext, id: ID): Promise<{
        members: PickOrderSnapshot[];
    } | null>;
    private toView;
    /** 批次成员订单快照（含推荐仓与距离） */
    membersSnapshot(ctx: RequestContext, batchId: ID): Promise<PickOrderSnapshot[]>;
    /**
     * 待发货候选订单：默认 PaymentAuthorized / WaitingForShipping，
     * 带就近仓推荐与「已在某批次」标记（设计 §6.2）。
     */
    candidates(ctx: RequestContext, options: PickBatchListOptions): Promise<{
        totalItems: number;
        items: PickOrderSnapshot[];
    }>;
    private snapshotOrder;
    /** 订单行中尚未被任何履约覆盖的部分 */
    private pendingFulfillmentLines;
    /**
     * 批量发货：逐单生成独立 fulfillment（不合并包裹、不合并运单）。
     * 全部成功才推进到 SHIPPED；有失败则保持原状态并返回失败清单（设计 §5）。
     */
    ship(ctx: RequestContext, batchId: ID, input: {
        method: string;
        trackingCode?: string | null;
    }): Promise<{
        succeeded: Array<{
            orderId: string;
            code: string;
            fulfillmentId: string | null;
        }>;
        failed: Array<{
            orderId: string;
            code: string;
            reason: string;
        }>;
    }>;
    private requireBatch;
    private assertState;
}
