import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { PickBatchState } from './pick-batch.entity';
import { PickBatchService } from './pick-batch.service';
/** 配货台（拣货批次）admin 接口 */
export declare class PickBatchAdminResolver {
    private pickBatchService;
    private connection;
    constructor(pickBatchService: PickBatchService, connection: TransactionalConnection);
    pickBatches(ctx: RequestContext, args: any): Promise<{
        totalItems: number;
        items: Record<string, unknown>[];
    }>;
    pickBatch(ctx: RequestContext, id: ID): Promise<{
        members: import("./pick-batch.service").PickOrderSnapshot[];
    } | null>;
    /** 看板「拣货单数」KPI（D48）：服务端按窗口 COUNT，绕开 findAll 的 pageSize ≤ 100 硬上限 */
    pickBatchShippedCount(ctx: RequestContext, from?: string, to?: string): Promise<number>;
    pickBatchPickingList(ctx: RequestContext, id: ID): Promise<import("./pick-batch-math").PickingRow[]>;
    pickBatchCandidates(ctx: RequestContext, args: any): Promise<{
        totalItems: number;
        items: import("./pick-batch.service").PickOrderSnapshot[];
    }>;
    createPickBatch(ctx: RequestContext, input: any): Promise<{
        members: import("./pick-batch.service").PickOrderSnapshot[];
    } | null>;
    addOrdersToPickBatch(ctx: RequestContext, batchId: ID, orderIds: ID[]): Promise<{
        members: import("./pick-batch.service").PickOrderSnapshot[];
    } | null>;
    removeOrdersFromPickBatch(ctx: RequestContext, batchId: ID, orderIds: ID[]): Promise<{
        members: import("./pick-batch.service").PickOrderSnapshot[];
    } | null>;
    advancePickBatchState(ctx: RequestContext, batchId: ID, to: PickBatchState): Promise<{
        members: import("./pick-batch.service").PickOrderSnapshot[];
    } | null>;
    cancelPickBatch(ctx: RequestContext, batchId: ID): Promise<{
        members: import("./pick-batch.service").PickOrderSnapshot[];
    } | null>;
    shipPickBatch(ctx: RequestContext, args: any): Promise<{
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
    handoverPickBatch(ctx: RequestContext, batchId: ID, handoverTo: string): Promise<{
        members: import("./pick-batch.service").PickOrderSnapshot[];
    } | null>;
    registerPickBatchException(ctx: RequestContext, batchId: ID, reason: string): Promise<{
        members: import("./pick-batch.service").PickOrderSnapshot[];
    } | null>;
    /** 操作人：优先 TenantMember.displayName，回退 Administrator 名字
     *  （D47 修正键错位：ctx.activeUserId 是 User.id，而 TenantMember.administratorId 存的是 Administrator.id，
     *    旧写法两步都用 User.id 去匹配 → 恒返回 null，"创建人" 永远为空。换键统一走共享 helper。） */
    private currentOperator;
}
