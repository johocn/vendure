import { TransactionalConnection } from '@vendure/core';
import { PosSessionService } from '@vendure/vcash-pos-plugin';
import { Connection } from 'typeorm';
import { OfflineSessionRecord, SyncedSessionResult, SyncSessionFailureResult } from '../types';
import { OfflineSyncQueueService } from './sync-queue.service';
/**
 * 离线 PosSession 同步服务：
 * 1. 幂等校验
 * 2. 调 PosSessionService.openSession 创建 PosSession（terminalCode + openingFloat）
 * 3. 关联已同步的 Orders（通过 sessionCode 查 OfflineSyncQueue → 更新 Order.customFields.posSessionId）
 * 4. 如果 session.state='closed'：调 closeSession（closingCash）
 * 5. 成功 markSuccess（syncedOrderId 复用存 sessionId，syncedOrderCode 复用存 sessionCode）
 *
 * 关键约束：
 * - PosSessionService.openSession 不允许同一终端同时存在 open session
 * - 离线 sessionCode 是客户端生成的临时标识，用于关联 OfflineSyncQueue 中的 order 记录
 *   服务端 PosSession.code 由 generateSessionCode 自动生成
 * - 关联 Orders 时用 PRAGMA 查找 customFields_posSessionId 实际列名（参考 shift-report.service.ts）
 */
export declare class SyncSessionService {
    private queueService;
    private posSessionService;
    private connection;
    private transactionalConnection;
    constructor(queueService: OfflineSyncQueueService, posSessionService: PosSessionService, connection: Connection, transactionalConnection: TransactionalConnection);
    syncSingleSession(ctx: any, session: OfflineSessionRecord): Promise<SyncedSessionResult | SyncSessionFailureResult>;
    /**
     * 关联已同步的 Orders 到新创建的 PosSession。
     * 通过 OfflineSyncQueue.sessionCode 查找同班次的 order 记录，
     * 取 syncedOrderId 后用 PRAGMA 查找 customFields_posSessionId 列名做 raw SQL 更新。
     */
    private associateOrders;
}
