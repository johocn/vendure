import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { PickBatch, PickBatchState } from './pick-batch.entity';
import { PickBatchOrder } from './pick-batch-order.entity';
import { sortPickingRows, type WarehouseCandidate } from './pick-batch-math';
export interface PickBatchListOptions {
    page?: number;
    pageSize?: number;
    state?: PickBatchState | null;
    stockLocationId?: number | null;
}
export declare class PickBatchService {
    private connection;
    constructor(connection: TransactionalConnection);
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
    findConflicts(ctx: RequestContext, orderIds: number[], excludeBatchId?: number): Promise<Map<number, string>>;
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
    private requireBatch;
    private assertState;
}
