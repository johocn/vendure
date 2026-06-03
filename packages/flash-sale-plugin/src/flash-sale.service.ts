import { Injectable } from '@nestjs/common';
import {
    ID,
    Injector,
    ListQueryBuilder,
    ListQueryOptions,
    Logger,
    OrderService,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { FlashSaleActivity } from './flash-sale-activity.entity';

@Injectable()
export class FlashSaleService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private orderService: OrderService,
    ) {}

    private stockReserveService: any = null;

    init(injector: Injector): void {
        try {
            const { StockReserveService } = require('@vendure/redis-stock-plugin');
            this.stockReserveService = injector.get(StockReserveService);
        } catch {
            // RedisStockPlugin not installed, use DB fallback
        }
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<FlashSaleActivity>,
    ): Promise<PaginatedList<FlashSaleActivity>> {
        return this.listQueryBuilder
            .build(FlashSaleActivity, options, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels'],
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<FlashSaleActivity | undefined> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const result = await repo.findOne({
            where: { id: id as any },
            relations: { channels: true },
        });
        return result ?? undefined;
    }

    async create(ctx: RequestContext, input: Partial<FlashSaleActivity>): Promise<FlashSaleActivity> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const activity = new FlashSaleActivity(input as any);
        activity.channels = [ctx.channel];
        const now = new Date();
        if (activity.startAt && now >= activity.startAt) {
            activity.status = 'active';
        } else {
            activity.status = 'upcoming';
        }
        return repo.save(activity);
    }

    async update(ctx: RequestContext, input: any): Promise<FlashSaleActivity> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const activity = await repo.findOne({ where: { id: input.id } });
        if (!activity) {
            throw new Error(`FlashSaleActivity with id ${input.id} not found`);
        }
        Object.assign(activity, input);
        return repo.save(activity);
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        await repo.delete(id);
    }

    async checkEligibility(
        ctx: RequestContext,
        activityId: ID,
        customerId: ID,
    ): Promise<{ eligible: boolean; reason?: string }> {
        const activity = await this.findOne(ctx, activityId);
        if (!activity) {
            return { eligible: false, reason: 'Activity not found' };
        }

        const now = new Date();
        if (now < activity.startAt) {
            return { eligible: false, reason: 'Activity has not started' };
        }
        if (now > activity.endAt) {
            return { eligible: false, reason: 'Activity has ended' };
        }

        if (this.stockReserveService?.isAvailable) {
            const remaining = await this.stockReserveService.reserveStock(
                `flash-sale:${activityId}`,
                1,
            );
            if (remaining < 0) {
                return { eligible: false, reason: 'Stock sold out' };
            }
        } else {
            if (activity.soldCount >= activity.totalStock) {
                return { eligible: false, reason: 'Stock sold out' };
            }
        }

        const existingOrders = await this.orderService.findByCustomerId(ctx, customerId);
        const flashSaleOrders = existingOrders.items.filter(
            (o: any) => o.customFields?.flashSaleActivityId === activityId && o.state !== 'Cancelled',
        );
        if (flashSaleOrders.length >= activity.limitPerUser) {
            if (this.stockReserveService?.isAvailable) {
                await this.stockReserveService.releaseStock(`flash-sale:${activityId}`, 1);
            }
            return { eligible: false, reason: 'Purchase limit exceeded' };
        }

        return { eligible: true };
    }

    async findActive(ctx: RequestContext): Promise<FlashSaleActivity[]> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const now = new Date();
        return repo
            .createQueryBuilder('fsa')
            .innerJoin('fsa.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('fsa.status = :status', { status: 'active' })
            .andWhere('fsa.startAt <= :now', { now })
            .andWhere('fsa.endAt >= :now', { now })
            .getMany();
    }

    async findActiveByVariant(ctx: RequestContext, variantId: ID): Promise<FlashSaleActivity | undefined> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const now = new Date();
        const result = await repo
            .createQueryBuilder('fsa')
            .innerJoin('fsa.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('fsa.variantId = :variantId', { variantId: variantId as any })
            .andWhere('fsa.status = :status', { status: 'active' })
            .andWhere('fsa.startAt <= :now', { now })
            .andWhere('fsa.endAt >= :now', { now })
            .getOne();
        return result ?? undefined;
    }

    async incrementSoldCount(ctx: RequestContext, activityId: ID, quantity: number): Promise<void> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        await repo.increment({ id: activityId as any }, 'soldCount', quantity);
        const activity = await this.findOne(ctx, activityId);
        if (activity && activity.soldCount >= activity.totalStock) {
            activity.status = 'ended';
            await repo.save(activity);
            Logger.info(`FlashSaleActivity ${activityId} ended due to stock depletion`, loggerCtx);
        }
    }
}
