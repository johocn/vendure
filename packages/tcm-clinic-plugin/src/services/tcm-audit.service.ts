import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { TcmAuditLog } from '../entities/tcm-audit-log.entity';

@Injectable()
export class TcmAuditService {
    constructor(private connection: TransactionalConnection) {}

    /** 与业务写操作同一 ctx 事务内调用 */
    async log(
        ctx: RequestContext,
        input: { entityType: string; entityId: number; staffId: number; action: string; diff?: Record<string, any> },
    ): Promise<void> {
        await this.connection.getRepository(ctx, TcmAuditLog).save(new TcmAuditLog(input));
    }

    /** 只读分页查询 */
    async findAll(
        ctx: RequestContext,
        options: { skip?: number; take?: number } = {},
    ): Promise<{ items: TcmAuditLog[]; totalItems: number }> {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmAuditLog)
            .findAndCount({ skip: options.skip, take: options.take, order: { id: 'ASC' } });
        return { items, totalItems };
    }
}
