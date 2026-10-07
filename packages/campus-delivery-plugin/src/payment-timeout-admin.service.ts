import { Injectable } from '@nestjs/common';
import { Between, In, LessThan } from 'typeorm';
import { Order, TransactionalConnection } from '@vendure/core';

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

    /** 任务分页列表（dueAt 倒序），附带订单号/订单状态摘要 */
    async listTasks(opts: { status?: string; type?: string; from?: Date; to?: Date; skip?: number; take?: number; }) {
        const take = Math.min(opts.take ?? 20, 100);
        const where: Record<string, any> = {};
        if (opts.status) where.status = opts.status;
        if (opts.type) where.type = opts.type;
        if (opts.from || opts.to) where.dueAt = Between(opts.from ?? new Date(0), opts.to ?? new Date('2999-12-31'));
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

    /** 看板统计：今日已提醒 / 今日已取消 / 累计失败 / 逾期未处理 */
    async getStats() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const [todayRemind, todayCancel, totalFailed, pendingOverdue] = await Promise.all([
            this.taskRepo.count({ where: { type: PaymentTimeoutType.REMIND, status: PaymentTimeoutStatus.EXECUTED, dueAt: Between(startOfDay, new Date()) } as any }),
            this.taskRepo.count({ where: { type: PaymentTimeoutType.CANCEL, status: PaymentTimeoutStatus.EXECUTED, dueAt: Between(startOfDay, new Date()) } as any }),
            this.taskRepo.count({ where: { status: PaymentTimeoutStatus.FAILED } as any }),
            this.taskRepo.count({ where: { status: PaymentTimeoutStatus.PENDING, dueAt: LessThan(new Date()) } as any }),
        ]);
        return { todayRemind, todayCancel, totalFailed, pendingOverdue };
    }

    executeTask(id: number) {
        return this.job.executeTaskNow(id);
    }

    resendRemind(taskId: number) {
        return this.job.resendRemind(taskId);
    }

    runCompensationNow() {
        return this.job.runCompensation();
    }
}
