import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { CampusCompensationTask } from './compensation-task.entity';
export interface CompensationTaskInput {
    orderId: number;
    channelId: number;
    customerId?: number | null;
    kind: 'coupon' | 'notify';
    payload?: Record<string, unknown>;
    dedupeKey: string;
}
/** R2 补偿任务入队/认领/收敛：只做持久化，执行逻辑在 CompensationRetryJob。
 * 入队失败只记日志（补偿是旁路能力，绝不反向影响主流程）。 */
export declare class CompensationTaskService {
    private connection;
    private requestContextService;
    constructor(connection: TransactionalConnection, requestContextService: RequestContextService);
    private platformCtx;
    /** 补偿券发放失败入队；同单同模板只保留一条（ON CONFLICT 幂等） */
    enqueueCoupon(input: {
        orderId: number;
        channelId: number;
        customerId: number;
        templateId: string;
        orderCode: string;
    }): Promise<void>;
    /** 站内信写入失败入队；同单同事件（含后缀）只保留一条 */
    enqueueNotify(input: {
        orderId: number;
        channelId: number;
        customerId?: number | null;
        event: string;
        orderCode?: string;
        text?: string;
        suffix?: string;
    }): Promise<void>;
    private enqueue;
    /** 到期待处理任务（按 nextAttemptAt 升序，最多 limit 条） */
    due(limit?: number): Promise<CampusCompensationTask[]>;
    /** 条件认领：仅当状态仍为 pending 且 attempts 未变时成功（多实例/并发安全） */
    claim(id: number, attempts: number): Promise<boolean>;
    markDone(id: number): Promise<void>;
    /** 未耗尽：回 pending 并排下次时间；耗尽：置 failed（由调用方发一次告警） */
    markFailed(id: number, exhausted: boolean, error: string, nextAttemptAt: Date | null): Promise<void>;
}
