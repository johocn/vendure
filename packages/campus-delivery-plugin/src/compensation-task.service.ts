import { Injectable, Logger } from '@nestjs/common';
import { RequestContext, RequestContextService, TransactionalConnection, UserInputError } from '@vendure/core';
import { LessThanOrEqual } from 'typeorm';
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
@Injectable()
export class CompensationTaskService {
    constructor(
        private connection: TransactionalConnection,
        private requestContextService: RequestContextService,
    ) {}

    private async platformCtx(): Promise<RequestContext> {
        return this.requestContextService.create({ apiType: 'admin' });
    }

    /** 补偿券发放失败入队；同单同模板只保留一条（ON CONFLICT 幂等） */
    async enqueueCoupon(input: {
        orderId: number;
        channelId: number;
        customerId: number;
        templateId: string;
        orderCode: string;
    }): Promise<void> {
        await this.enqueue({
            orderId: input.orderId,
            channelId: input.channelId,
            customerId: input.customerId,
            kind: 'coupon',
            payload: { templateId: input.templateId, orderCode: input.orderCode },
            dedupeKey: `coupon:${input.orderCode}:${input.templateId}`,
        });
    }

    /** 站内信写入失败入队；同单同事件（含后缀）只保留一条 */
    async enqueueNotify(input: {
        orderId: number;
        channelId: number;
        customerId?: number | null;
        event: string;
        orderCode?: string;
        text?: string;
        suffix?: string;
    }): Promise<void> {
        await this.enqueue({
            orderId: input.orderId,
            channelId: input.channelId,
            customerId: input.customerId ?? null,
            kind: 'notify',
            payload: { event: input.event, text: input.text, orderCode: input.orderCode },
            dedupeKey: `notify:${input.orderId}:${input.event}${input.suffix ? `:${input.suffix}` : ''}`,
        });
    }

    private async enqueue(input: CompensationTaskInput): Promise<void> {
        try {
            await this.connection.rawConnection.query(
                'INSERT INTO campus_compensation_task '
                + '("orderId","channelId","customerId",kind,payload,"dedupeKey",status,attempts,"nextAttemptAt") '
                + "VALUES ($1,$2,$3,$4,$5,$6,'pending',0,$7) ON CONFLICT (\"dedupeKey\") DO NOTHING",
                [
                    input.orderId,
                    input.channelId,
                    input.customerId ?? null,
                    input.kind,
                    JSON.stringify(input.payload ?? {}),
                    input.dedupeKey,
                    new Date(),
                ],
            );
        } catch (e: any) {
            Logger.error(`补偿任务入队失败（${input.dedupeKey}）：${e?.message ?? e}`, 'CampusCompensation');
        }
    }

    private static readonly STATUSES = ['pending', 'done', 'failed'];

    /** 管理端任务列表（按 createdAt 倒序）；status 为空返回全部 */
    async list(status?: string, skip?: number, take?: number) {
        const pc = await this.platformCtx();
        const where: Record<string, unknown> = {};
        if (status) {
            if (!CompensationTaskService.STATUSES.includes(status)) throw new UserInputError('补偿任务状态不合法');
            where.status = status;
        }
        const [items, total] = await this.connection.getRepository(pc, CampusCompensationTask).findAndCount({
            where: where as any,
            order: { createdAt: 'DESC' } as any,
            skip: Math.max(0, Number(skip) || 0),
            take: Math.min(200, Math.max(1, Number(take) || 20)),
        });
        return { items, total };
    }

    /** 管理端手动重试：failed/pending 重置为立即可执行；返回是否命中（done 任务不重置） */
    async retry(id: number): Promise<boolean> {
        const res: any = await this.connection.rawConnection.query(
            'UPDATE campus_compensation_task SET status = $1, attempts = 0, "nextAttemptAt" = now(), '
            + '"lastError" = NULL, "updatedAt" = now() '
            + "WHERE id = $2 AND status IN ('failed', 'pending') RETURNING id",
            ['pending', id],
        );
        const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
        return Array.isArray(rows) && rows.length > 0;
    }

    /** 到期待处理任务（按 nextAttemptAt 升序，最多 limit 条） */
    async due(limit = 20): Promise<CampusCompensationTask[]> {
        const pc = await this.platformCtx();
        const now = new Date();
        return this.connection.getRepository(pc, CampusCompensationTask).find({
            where: { status: 'pending', nextAttemptAt: LessThanOrEqual(now) } as any,
            order: { nextAttemptAt: 'ASC' } as any,
            take: limit,
        });
    }

    /** 条件认领：仅当状态仍为 pending 且 attempts 未变时成功（多实例/并发安全） */
    async claim(id: number, attempts: number): Promise<boolean> {
        const res: any = await this.connection.rawConnection.query(
            'UPDATE campus_compensation_task SET attempts = attempts + 1, "updatedAt" = now() '
            + "WHERE id = $1 AND status = 'pending' AND attempts = $2 RETURNING id",
            [id, attempts],
        );
        const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
        return Array.isArray(rows) && rows.length > 0;
    }

    async markDone(id: number): Promise<void> {
        await this.connection.rawConnection.query(
            "UPDATE campus_compensation_task SET status = 'done', \"lastError\" = NULL, "
            + '"nextAttemptAt" = NULL, "updatedAt" = now() WHERE id = $1',
            [id],
        );
    }

    /** 未耗尽：回 pending 并排下次时间；耗尽：置 failed（由调用方发一次告警） */
    async markFailed(id: number, exhausted: boolean, error: string, nextAttemptAt: Date | null): Promise<void> {
        await this.connection.rawConnection.query(
            'UPDATE campus_compensation_task SET status = $1, "lastError" = $2, "nextAttemptAt" = $3, '
            + '"updatedAt" = now() WHERE id = $4',
            [exhausted ? 'failed' : 'pending', error.slice(0, 255), exhausted ? null : nextAttemptAt, id],
        );
    }
}
