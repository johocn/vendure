import { Connection } from 'typeorm';
import { OfflineSyncQueue } from '../entities/offline-sync-queue.entity';
/**
 * 离线同步队列服务：幂等校验 + LWW + 状态机。
 * - findExisting: 按 idempotencyKey 查已有记录
 * - savePending: 新建 pending 记录
 * - markSuccess/markFailed/markNeedsManual: 状态流转
 * - isStaleVersion: LWW 比较（新 clientUpdatedAt 更旧则返回 true）
 */
export declare class OfflineSyncQueueService {
    private connection;
    constructor(connection: Connection);
    findExisting(idempotencyKey: string): Promise<OfflineSyncQueue | null>;
    savePending(record: {
        idempotencyKey: string;
        type: 'order' | 'payment' | 'session';
        payload: any;
        clientCreatedAt: Date;
        clientUpdatedAt: Date;
        sessionCode?: string;
    }): Promise<OfflineSyncQueue>;
    markSuccess(id: number, syncedOrderId: number, syncedOrderCode: string): Promise<void>;
    markFailed(id: number, error: {
        code: string;
        message: string;
    }): Promise<void>;
    markNeedsManual(id: number): Promise<void>;
    /**
     * LWW 比较：新 clientUpdatedAt 更旧（更早）则返回 true（stale）。
     * 相同时间戳不算 stale（允许重试）。
     */
    isStaleVersion(clientUpdatedAt: Date, existingClientUpdatedAt: Date): boolean;
    delete(id: number): Promise<void>;
}
