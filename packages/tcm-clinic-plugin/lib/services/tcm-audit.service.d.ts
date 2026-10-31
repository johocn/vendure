import { RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmAuditLog } from '../entities/tcm-audit-log.entity';
export declare class TcmAuditService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 与业务写操作同一 ctx 事务内调用 */
    log(ctx: RequestContext, input: {
        entityType: string;
        entityId: number;
        staffId: number;
        action: string;
        diff?: Record<string, any>;
    }): Promise<void>;
    /**
     * 只读分页查询。
     * 审计日志无 clinicId 列，按操作人 staffId 归属过滤：
     * staffIds 为 undefined 时不限（调用方已确认是 SuperAdmin）；空数组 = 无归属，返回空。
     */
    findAll(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }, staffIds?: number[]): Promise<{
        items: TcmAuditLog[];
        totalItems: number;
    }>;
}
