import { TransactionalConnection } from '@vendure/core';
import { Connection } from 'typeorm';
import { OfflinePaymentSyncRecord, SyncedPaymentResult, SyncPaymentFailureResult } from '../types';
import { OfflineSyncQueueService } from './sync-queue.service';
/**
 * 离线 Payment 同步服务：
 * 1. 幂等校验（同 sync-order 逻辑）
 * 2. 按 orderKey 找已同步的 Order（从 OfflineSyncQueue 查 syncedOrderId）
 * 3. 创建 Payment（method, amount, state='Settled'）并关联 Order
 * 4. 成功 markSuccess / 失败 markFailed
 *
 * syncedOrderId 字段在 type='payment' 记录中复用为 paymentId。
 */
export declare class SyncPaymentService {
    private queueService;
    private connection;
    private transactionalConnection;
    constructor(queueService: OfflineSyncQueueService, connection: Connection, transactionalConnection: TransactionalConnection);
    syncSinglePayment(ctx: any, payment: OfflinePaymentSyncRecord): Promise<SyncedPaymentResult | SyncPaymentFailureResult>;
}
