import { Injectable } from '@nestjs/common';
import {
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { InstallmentPlan } from './installment-plan.entity';

const INTERVAL_UNITS: ReadonlyArray<string> = ['day', 'week', 'month'];

@Injectable()
export class InstallmentService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    private repo(ctx: RequestContext) {
        return this.connection.getRepository(ctx, InstallmentPlan);
    }

    async findAll(ctx: RequestContext, options?: ListQueryOptions<InstallmentPlan>): Promise<PaginatedList<InstallmentPlan>> {
        return this.listQueryBuilder
            .build(InstallmentPlan, options, { ctx, channelId: ctx.channelId, relations: ['channels'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findByVariant(ctx: RequestContext, variantId: ID): Promise<InstallmentPlan[]> {
        return this.repo(ctx)
            .createQueryBuilder('plan')
            .innerJoin('plan.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
            .where('plan.variantId = :vid', { vid: Number(variantId) })
            .andWhere('plan.enabled = :enabled', { enabled: true })
            .getMany();
    }

    async findOne(ctx: RequestContext, id: ID): Promise<InstallmentPlan | undefined> {
        return (await this.repo(ctx).findOne({ where: { id: id as any } })) ?? undefined;
    }

    async create(ctx: RequestContext, input: Partial<InstallmentPlan>): Promise<InstallmentPlan> {
        this.assertValid(input);
        const plan = new InstallmentPlan(input as any);
        plan.channels = [ctx.channel];
        return this.repo(ctx).save(plan);
    }

    async update(ctx: RequestContext, input: any): Promise<InstallmentPlan> {
        const plan = await this.repo(ctx).findOne({ where: { id: input.id } });
        if (!plan) {
            throw new UserInputError(`InstallmentPlan ${input.id} not found`);
        }
        const merged = { ...plan, ...input };
        this.assertValid(merged);
        Object.assign(plan, input);
        return this.repo(ctx).save(plan);
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        await this.repo(ctx).delete(id);
    }

    /** 参数硬校验（设计 §5：首付比 0-90 / 期数 1-36） */
    private assertValid(plan: Partial<InstallmentPlan>): void {
        if (plan.downPaymentRatio != null && (plan.downPaymentRatio < 0 || plan.downPaymentRatio > 90)) {
            throw new UserInputError('downPaymentRatio must be between 0 and 90');
        }
        if (plan.periods != null && (plan.periods < 1 || plan.periods > 36)) {
            throw new UserInputError('periods must be between 1 and 36');
        }
        if (plan.intervalUnit != null && !INTERVAL_UNITS.includes(plan.intervalUnit)) {
            throw new UserInputError('intervalUnit must be day/week/month');
        }
        if (plan.intervalCount != null && plan.intervalCount < 0) {
            throw new UserInputError('intervalCount must be >= 0');
        }
    }
}
