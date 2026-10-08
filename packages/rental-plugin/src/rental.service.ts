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

import { RentalPlan } from './rental-plan.entity';

const RENT_UNITS: ReadonlyArray<string> = ['day', 'week', 'month'];
const PAYMENT_MODES: ReadonlyArray<string> = ['prepaid', 'postpaid'];

@Injectable()
export class RentalService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    private repo(ctx: RequestContext) {
        return this.connection.getRepository(ctx, RentalPlan);
    }

    async findAll(ctx: RequestContext, options?: ListQueryOptions<RentalPlan>): Promise<PaginatedList<RentalPlan>> {
        return this.listQueryBuilder
            .build(RentalPlan, options, { ctx, channelId: ctx.channelId, relations: ['channels'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findByVariant(ctx: RequestContext, variantId: ID): Promise<RentalPlan[]> {
        return this.repo(ctx)
            .createQueryBuilder('plan')
            .innerJoin('plan.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
            .where('plan.variantId = :vid', { vid: Number(variantId) })
            .andWhere('plan.enabled = :enabled', { enabled: true })
            .getMany();
    }

    async findOne(ctx: RequestContext, id: ID): Promise<RentalPlan | undefined> {
        return (await this.repo(ctx).findOne({ where: { id: id as any } })) ?? undefined;
    }

    async create(ctx: RequestContext, input: Partial<RentalPlan>): Promise<RentalPlan> {
        this.assertValid(input);
        const plan = new RentalPlan(input as any);
        plan.channels = [ctx.channel];
        return this.repo(ctx).save(plan);
    }

    async update(ctx: RequestContext, input: any): Promise<RentalPlan> {
        const plan = await this.repo(ctx).findOne({ where: { id: input.id } });
        if (!plan) {
            throw new UserInputError(`RentalPlan ${input.id} not found`);
        }
        const merged = { ...plan, ...input };
        this.assertValid(merged);
        Object.assign(plan, input);
        return this.repo(ctx).save(plan);
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        await this.repo(ctx).delete(id);
    }

    /** 参数硬校验（押金/租金必须为正；买断价可为 null 但不可为负） */
    private assertValid(plan: Partial<RentalPlan>): void {
        if (plan.depositAmount != null && plan.depositAmount <= 0) {
            throw new UserInputError('depositAmount must be > 0');
        }
        if (plan.rentAmount != null && plan.rentAmount <= 0) {
            throw new UserInputError('rentAmount must be > 0');
        }
        if (plan.rentUnit != null && !RENT_UNITS.includes(plan.rentUnit)) {
            throw new UserInputError('rentUnit must be day/week/month');
        }
        if (plan.prepaidOrPostpaid != null && !PAYMENT_MODES.includes(plan.prepaidOrPostpaid)) {
            throw new UserInputError('prepaidOrPostpaid must be prepaid/postpaid');
        }
        if (plan.buyoutPrice != null && plan.buyoutPrice < 0) {
            throw new UserInputError('buyoutPrice must be >= 0');
        }
    }
}
