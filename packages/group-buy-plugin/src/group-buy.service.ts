import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    ID,
    Injector,
    ListQueryBuilder,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';

const ALLOWED_UPDATE_FIELDS = [
    'name',
    'description',
    'startAt',
    'endAt',
    'targetCount',
    'maxCount',
    'groupPrice',
    'leaderDiscount',
    'leaderRewardType',
    'productId',
    'variantId',
    'autoConfirm',
    'allowJoinAfterComplete',
    'status',
] as const;

@Injectable()
export class GroupBuyService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
    ) {}

    private stockReserveService: any = null;
    private stockPrewarmService: any = null;

    init(injector: Injector): void {
        try {
            const { StockReserveService, StockPrewarmService } = require('@vendure/redis-stock-plugin');
            this.stockReserveService = injector.get(StockReserveService);
            this.stockPrewarmService = injector.get(StockPrewarmService);
        } catch {
            // RedisStockPlugin not installed, use DB fallback
        }
    }

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
        const saved = await repo.save(activity);
        if (this.stockPrewarmService && saved.status === 'active') {
            await this.stockPrewarmService.prewarm(`group-buy:${saved.id}`, saved.targetCount - saved.currentCount);
        }
        return saved;
    }

    async update(ctx: RequestContext, input: any): Promise<GroupBuyActivity> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const activity = await repo.findOne({ where: { id: input.id } });
        if (!activity) {
            throw new UserInputError(`GroupBuyActivity with id ${input.id} not found`);
        }
        const patch: Record<string, unknown> = {};
        for (const key of ALLOWED_UPDATE_FIELDS) {
            if (input[key] !== undefined) {
                patch[key] = input[key];
            }
        }
        Object.assign(activity, patch);
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

        await this.connection.startTransaction(ctx);
        try {
            const activity = await activityRepo.findOne({ where: { id: activityId as any } });
            if (!activity) {
                throw new UserInputError(`GroupBuyActivity with id ${activityId} not found`);
            }

            if (activity.status !== 'active') {
                throw new UserInputError('Activity is not active');
            }

            const now = new Date();
            if (activity.startAt && now < activity.startAt) {
                throw new UserInputError('Group buy activity has not started yet');
            }
            if (activity.endAt && now > activity.endAt) {
                throw new UserInputError('Group buy activity has ended');
            }

            if (this.stockReserveService?.isAvailable) {
                const remaining = await this.stockReserveService.reserveStock(
                    `group-buy:${activityId}`,
                    1,
                );
                if (remaining < 0) {
                    throw new UserInputError('Activity is already full');
                }
            } else {
                if (activity.currentCount >= activity.targetCount && !activity.allowJoinAfterComplete) {
                    throw new UserInputError('Activity is already full');
                }
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

            await this.connection.commitOpenTransaction(ctx);
            return savedOrder;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    async findActiveByVariant(ctx: RequestContext, variantId: ID): Promise<GroupBuyActivity[]> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const qb = repo.createQueryBuilder('gba');
        qb.innerJoin('gba.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        qb.where('gba.variantId = :variantId', { variantId: variantId as any });
        qb.andWhere('gba.status = :status', { status: 'active' });
        return qb.getMany();
    }

    async findActive(ctx: RequestContext): Promise<GroupBuyActivity[]> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const now = new Date();
        return repo
            .createQueryBuilder('gba')
            .innerJoin('gba.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('gba.status = :status', { status: 'active' })
            .andWhere('gba.startAt <= :now', { now })
            .andWhere('gba.endAt >= :now', { now })
            .getMany();
    }
}
