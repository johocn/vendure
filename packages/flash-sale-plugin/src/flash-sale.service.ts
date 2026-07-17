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
    UserInputError,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { FlashSaleActivity } from './flash-sale-activity.entity';

/**
 * update() 允许写入的字段白名单。
 * 显式过滤 soldCount/totalStock/status 等敏感字段，避免被外部 input 篡改。
 */
const UPDATE_ALLOWED_FIELDS: ReadonlyArray<keyof FlashSaleActivity> = [
    'name',
    'startAt',
    'endAt',
    'flashPrice',
    'totalStock',
    'limitPerUser',
    'productId',
    'variantId',
];

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
            throw new UserInputError(`FlashSaleActivity with id ${input.id} not found`);
        }
        // 字段白名单：禁止外部 input 篡改 soldCount/status 等内部字段
        for (const key of UPDATE_ALLOWED_FIELDS) {
            if (key in input) {
                (activity as any)[key] = input[key];
            }
        }
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
            // DB fallback：原子 UPDATE 实现 check + reserve，避免并发超卖
            const reserved = await this.reserveStockAtomic(ctx, activityId, 1);
            if (!reserved) {
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
            } else {
                // DB fallback：资格未通过，回滚上面原子预占的 1 单位
                await this.releaseStockAtomic(ctx, activityId, 1);
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
        // 原子 UPDATE：soldCount += quantity 仅在未超 totalStock 时生效
        const result = await repo
            .createQueryBuilder()
            .update()
            .set({ soldCount: () => `soldCount + ${quantity}` })
            .where('id = :id AND soldCount + :qty <= totalStock', { id: activityId as any, qty: quantity })
            .execute();
        if ((result.affected ?? 0) === 0) {
            Logger.warn(
                `FlashSaleActivity ${activityId}: soldCount + ${quantity} would exceed totalStock, increment skipped`,
                loggerCtx,
            );
        }
        const activity = await this.findOne(ctx, activityId);
        if (activity && activity.soldCount >= activity.totalStock) {
            activity.status = 'ended';
            await repo.save(activity);
            Logger.info(`FlashSaleActivity ${activityId} ended due to stock depletion`, loggerCtx);
        }
    }

    /**
     * 订单取消时回滚库存：Redis 路径走 StockReserveService，DB 路径走原子 UPDATE。
     */
    async releaseStock(ctx: RequestContext, activityId: ID, quantity: number): Promise<void> {
        if (this.stockReserveService?.isAvailable) {
            await this.stockReserveService.releaseStock(`flash-sale:${activityId}`, quantity);
        } else {
            await this.releaseStockAtomic(ctx, activityId, quantity);
        }
    }

    /**
     * DB fallback 原子预占：UPDATE ... SET soldCount = soldCount + quantity
     * WHERE id = ? AND soldCount + quantity <= totalStock。
     * 返回是否成功扣减（affected > 0）。
     */
    private async reserveStockAtomic(
        ctx: RequestContext,
        activityId: ID,
        quantity: number,
    ): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const result = await repo
            .createQueryBuilder()
            .update()
            .set({ soldCount: () => `soldCount + ${quantity}` })
            .where('id = :id AND soldCount + :qty <= totalStock', { id: activityId as any, qty: quantity })
            .execute();
        return (result.affected ?? 0) > 0;
    }

    /**
     * DB fallback 原子回滚：资格未通过或订单取消时，回滚预占的库存。
     * 使用 WHERE soldCount - quantity >= 0 防止负数。
     */
    private async releaseStockAtomic(
        ctx: RequestContext,
        activityId: ID,
        quantity: number,
    ): Promise<void> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        await repo
            .createQueryBuilder()
            .update()
            .set({ soldCount: () => `soldCount - ${quantity}` })
            .where('id = :id AND soldCount - :qty >= 0', { id: activityId as any, qty: quantity })
            .execute();
    }
}
