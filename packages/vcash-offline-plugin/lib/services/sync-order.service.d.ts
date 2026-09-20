import { PosOrderService } from '@vendure/vcash-pos-plugin';
import { OfflineSyncQueueService } from './sync-queue.service';
import { OfflineOrderRecord, SyncFailureResult, SyncedOrderResult } from '../types';
/**
 * 离线订单同步服务：
 * 1. 幂等校验：success → duplicate；failed + LWW → 重试；failed + stale → CONFLICT
 * 2. 创建 pending 队列记录
 * 3. 调用 PosOrderService.createOrderFromOffline 落库
 * 4. 成功 markSuccess / 失败 markFailed
 */
export declare class SyncOrderService {
    private queueService;
    private posOrderService;
    constructor(queueService: OfflineSyncQueueService, posOrderService: PosOrderService);
    syncSingleOrder(ctx: any, order: OfflineOrderRecord): Promise<SyncedOrderResult | SyncFailureResult>;
}
