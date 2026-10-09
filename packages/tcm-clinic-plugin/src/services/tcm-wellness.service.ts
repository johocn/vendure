import { Injectable } from '@nestjs/common';
import { IllegalOperationError, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { TcmFollowUpTask } from '../entities/tcm-follow-up-task.entity';
import { TcmPlanItem } from '../entities/tcm-plan-item.entity';
import { TcmWellnessPlan } from '../entities/tcm-wellness-plan.entity';
import { TcmAuditService } from './tcm-audit.service';

const PLAN_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['ACTIVE'],
    ACTIVE: ['PAUSED', 'CLOSED'],
    PAUSED: ['ACTIVE', 'CLOSED'],
    CLOSED: [],
};

@Injectable()
export class TcmWellnessService {
    constructor(private connection: TransactionalConnection, private audit: TcmAuditService) {}

    async createPlan(
        ctx: RequestContext,
        staffId: number,
        input: { patientProfileId: number; clinicId: number; title: string; cycleStart?: Date; cycleEnd?: Date },
    ): Promise<TcmWellnessPlan> {
        const plan = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .save(new TcmWellnessPlan({ ...input, status: 'DRAFT' }));
        await this.audit.log(ctx, { entityType: 'TcmWellnessPlan', entityId: Number(plan.id), staffId, action: 'CREATE' });
        return plan;
    }

    async transitionPlan(
        ctx: RequestContext,
        staffId: number,
        id: number,
        to: 'ACTIVE' | 'PAUSED' | 'CLOSED',
    ): Promise<TcmWellnessPlan> {
        const repo = this.connection.getRepository(ctx, TcmWellnessPlan);
        const plan = await repo.findOne({ where: { id } });
        if (!plan) {
            throw new UserInputError(`康养规划不存在：${id}`);
        }
        if (!PLAN_TRANSITIONS[plan.status].includes(to)) {
            throw new IllegalOperationError(`非法状态迁移：${plan.status} → ${to}`);
        }
        const saved = await repo.save({ ...plan, status: to });
        await this.audit.log(ctx, {
            entityType: 'TcmWellnessPlan',
            entityId: id,
            staffId,
            action: 'UPDATE',
            diff: { status: to },
        });
        return saved;
    }

    async addPlanItem(
        ctx: RequestContext,
        input: { planId: number; title: string; frequency?: string; productVariantId?: number },
    ): Promise<TcmPlanItem> {
        const plan = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .findOne({ where: { id: input.planId } });
        if (!plan || plan.status === 'CLOSED') {
            throw new UserInputError(`规划不可添加计划项：planId=${input.planId}`);
        }
        return this.connection.getRepository(ctx, TcmPlanItem).save(new TcmPlanItem(input));
    }

    async createFollowUp(
        ctx: RequestContext,
        staffId: number,
        input: { patientProfileId: number; planId?: number; title: string; dueAt: Date; channel?: string },
    ): Promise<TcmFollowUpTask> {
        const task = await this.connection.getRepository(ctx, TcmFollowUpTask).save(
            new TcmFollowUpTask({ ...input, channel: input.channel ?? 'wechat', status: 'PENDING' }),
        );
        await this.audit.log(ctx, { entityType: 'TcmFollowUpTask', entityId: Number(task.id), staffId, action: 'CREATE' });
        return task;
    }

    async completeFollowUp(
        ctx: RequestContext,
        staffId: number,
        id: number,
        followUpEncounterId?: number,
    ): Promise<TcmFollowUpTask> {
        const repo = this.connection.getRepository(ctx, TcmFollowUpTask);
        const task = await repo.findOne({ where: { id } });
        if (!task || task.status !== 'PENDING') {
            throw new UserInputError(`随访任务不可完成：id=${id}`);
        }
        const saved = await repo.save({ ...task, status: 'DONE', followUpEncounterId });
        await this.audit.log(ctx, {
            entityType: 'TcmFollowUpTask',
            entityId: id,
            staffId,
            action: 'UPDATE',
            diff: { status: 'DONE' },
        });
        return saved;
    }

    async cancelFollowUp(ctx: RequestContext, staffId: number, id: number): Promise<TcmFollowUpTask> {
        const repo = this.connection.getRepository(ctx, TcmFollowUpTask);
        const task = await repo.findOne({ where: { id } });
        if (!task || task.status !== 'PENDING') {
            throw new UserInputError(`随访任务不可取消：id=${id}`);
        }
        const saved = await repo.save({ ...task, status: 'CANCELED' });
        await this.audit.log(ctx, {
            entityType: 'TcmFollowUpTask',
            entityId: id,
            staffId,
            action: 'UPDATE',
            diff: { status: 'CANCELED' },
        });
        return saved;
    }

    async itemsOfPlan(ctx: RequestContext, planId: number): Promise<TcmPlanItem[]> {
        return this.connection.getRepository(ctx, TcmPlanItem).find({ where: { planId }, order: { id: 'ASC' } });
    }
}
