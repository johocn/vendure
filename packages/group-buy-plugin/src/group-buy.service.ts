import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';

@Injectable()
export class GroupBuyService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
    ) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<GroupBuyActivity>,
    ): Promise<PaginatedList<GroupBuyActivity>> {
        return this.listQueryBuilder
            .build(GroupBuyActivity, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<GroupBuyActivity | undefined> {
        const result = await this.connection.getRepository(ctx, GroupBuyActivity).findOne({
            where: { id: id as any },
            relations: { channels: true },
        });
        return result ?? undefined;
    }

    async create(ctx: RequestContext, input: Partial<GroupBuyActivity>): Promise<GroupBuyActivity> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const activity = new GroupBuyActivity(input);
        activity.channels = [ctx.channel];
        return repo.save(activity);
    }

    async update(ctx: RequestContext, input: any): Promise<GroupBuyActivity> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const activity = await repo.findOne({ where: { id: input.id } });
        if (!activity) {
            throw new Error(`GroupBuyActivity with id ${input.id} not found`);
        }
        Object.assign(activity, input);
        return repo.save(activity);
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        await repo.delete(id);
    }

    async joinGroupBuy(
        ctx: RequestContext,
        activityId: ID,
        orderId: ID,
        isLeader: boolean,
    ): Promise<GroupBuyOrder> {
        const activityRepo = this.connection.getRepository(ctx, GroupBuyActivity);
        const orderRepo = this.connection.getRepository(ctx, GroupBuyOrder);

        const activity = await activityRepo.findOne({ where: { id: activityId as any } });
        if (!activity) {
            throw new Error(`GroupBuyActivity with id ${activityId} not found`);
        }

        if (activity.status !== 'active') {
            throw new Error('Activity is not active');
        }

        if (activity.currentCount >= activity.targetCount && !activity.allowJoinAfterComplete) {
            throw new Error('Activity is already full');
        }

        const groupBuyOrder = new GroupBuyOrder({
            groupBuyActivityId: String(activityId),
            orderId: String(orderId),
            isLeader,
            status: 'pending',
        });
        const savedOrder = await orderRepo.save(groupBuyOrder);

        activity.currentCount += 1;
        if (activity.currentCount >= activity.targetCount) {
            activity.status = 'completed';
        }
        await activityRepo.save(activity);

        return savedOrder;
    }

    async findActiveByVariant(ctx: RequestContext, variantId: ID): Promise<GroupBuyActivity[]> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const qb = repo.createQueryBuilder('gba');
        qb.innerJoin('gba.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        qb.where('gba.variantId = :variantId', { variantId: variantId as any });
        qb.andWhere('gba.status = :status', { status: 'active' });
        return qb.getMany();
    }
}
