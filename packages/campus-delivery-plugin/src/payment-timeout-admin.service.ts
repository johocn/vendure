import { Injectable } from '@nestjs/common';
import { Between, In, LessThan } from 'typeorm';
import { Order, Permission, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { PaymentTimeoutJob } from './payment-timeout.job';
import { PaymentTimeoutStatus, PaymentTimeoutTask, PaymentTimeoutType } from './payment-timeout.entity';

export interface PaymentTimeoutTaskRow extends PaymentTimeoutTask {
    orderCode: string | null;
    orderState: string | null;
}

@Injectable()
export class PaymentTimeoutAdminService {
    private taskRepo = this.connection.rawConnection.getRepository(PaymentTimeoutTask);
    private orderRepo = this.connection.rawConnection.getRepository(Order);

    constructor(
        private connection: TransactionalConnection,
        private job: PaymentTimeoutJob,
    ) {}

    private isPlatformAdmin(ctx: RequestContext): boolean {
        return ctx.userHasPermissions([Permission.SuperAdmin]);
    }

    /** 非平台超管只能操作本渠道任务，避免误读/误取消其他店铺待付款单 */
    private async assertTaskScope(ctx: RequestContext, id: number): Promise<void> {
        if (this.isPlatformAdmin(ctx)) return;
        const task = await this.taskRepo.findOne({ where: { id } as any });
        if (!task || Number(task.channelId) !== Number(ctx.channelId)) {
            throw new UserInputError('任务不属于当前店铺');
        }
    }

    /** 任务分页列表（dueAt 倒序），附带订单号/订单状态摘要 */
    async listTasks(ctx: RequestContext, opts: { status?: string; type?: string; from?: Date; to?: Date; skip?: number; take?: number; }) {
        const take = Math.min(opts.take ?? 20, 100);
        const where: Record<string, any> = {};
        if (opts.status) where.status = opts.status;
        if (opts.type) where.type = opts.type;
        if (opts.from || opts.to) where.dueAt = Between(opts.from ?? new Date(0), opts.to ?? new Date('2999-12-31'));
        if (!this.isPlatformAdmin(ctx)) where.channelId = Number(ctx.channelId);
        const [tasks, total] = await this.taskRepo.findAndCount({
            where: where as any,
            order: { dueAt: 'DESC' } as any,
            skip: opts.skip ?? 0,
            take,
        });
        const ids = [...new Set(tasks.map(t => Number(t.orderId)))];
        const orders = ids.length ? await this.orderRepo.find({ where: { id: In(ids) } as any }) : [];
        const byId = new Map(orders.map((o: any) => [Number(o.id), o]));
        const items: PaymentTimeoutTaskRow[] = tasks.map(t => ({
            ...t,
            orderCode: byId.get(Number(t.orderId))?.code ?? null,
            orderState: byId.get(Number(t.orderId))?.state ?? null,
        }));
        return { items, total };
    }

    /** 看板统计：今日已提醒 / 今日已取消 / 累计失败 / 逾期未处理（非超管限本渠道） */
    async getStats(ctx: RequestContext) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const scope: Record<string, any> = this.isPlatformAdmin(ctx) ? {} : { channelId: Number(ctx.channelId) };
        const [todayRemind, todayCancel, totalFailed, pendingOverdue] = await Promise.all([
            this.taskRepo.count({ where: { ...scope, type: PaymentTimeoutType.REMIND, status: PaymentTimeoutStatus.EXECUTED, dueAt: Between(startOfDay, new Date()) } as any }),
            this.taskRepo.count({ where: { ...scope, type: PaymentTimeoutType.CANCEL, status: PaymentTimeoutStatus.EXECUTED, dueAt: Between(startOfDay, new Date()) } as any }),
            this.taskRepo.count({ where: { ...scope, status: PaymentTimeoutStatus.FAILED } as any }),
            this.taskRepo.count({ where: { ...scope, status: PaymentTimeoutStatus.PENDING, dueAt: LessThan(new Date()) } as any }),
        ]);
        return { todayRemind, todayCancel, totalFailed, pendingOverdue };
    }

    async executeTask(ctx: RequestContext, id: number) {
        await this.assertTaskScope(ctx, id);
        return this.job.executeTaskNow(id);
    }

    async resendRemind(ctx: RequestContext, taskId: number) {
        await this.assertTaskScope(ctx, taskId);
        return this.job.resendRemind(taskId);
    }

    runCompensationNow() {
        return this.job.runCompensation();
    }
}
