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
    /** 只读分页查询 */
    findAll(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }): Promise<{
        items: TcmAuditLog[];
        totalItems: number;
    }>;
}
