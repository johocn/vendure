import { Injectable } from '@nestjs/common';
import {
    Customer,
    CustomerService,
    EntityNotFoundError,
    ID,
    ListQueryBuilder,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';
import { MemberLevelService } from '@vendure/member-level-plugin';

import { loggerCtx } from './constants';
import { LotteryPrize } from './lottery-prize.entity';
import { LotteryRecord } from './lottery-record.entity';
import {
    CreateLotteryPrizeInput,
    LotteryDrawResult,
    LotteryPrizeListOptions,
    LotteryRecordListOptions,
    UpdateLotteryPrizeInput,
} from './types';

/** C 端九宫格固定 8 槽：启用中的奖品硬上限（超出会按取模对位，语义混乱）。 */
const MAX_ENABLED_PRIZES = 8;

@Injectable()
export class LotteryService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
        /** 积分桥软依赖（checkin-plugin 同款直注，需与 MemberLevelPlugin 同容器） */
        private memberService: MemberLevelService,
    ) {}

    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径）。 */
    private async requireCustomer(ctx: RequestContext): Promise<Customer> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }

    /**
     * 参与开奖的奖品全集（shop 展示与 draw 共用同一份，保证 prizeIndex 同源）：
     * enabled + 当前渠道或全渠道 + 库存可用（null=不限量），按 sort ASC/id ASC 排序。
     * weight <= 0 的奖项保留在下标序列中（仅展示，不参与加权抽取）。
     */
    private enabledPrizes(ctx: RequestContext): Promise<LotteryPrize[]> {
        return this.connection
            .getRepository(ctx, LotteryPrize)
            .createQueryBuilder('prize')
            .where('prize.enabled = :enabled', { enabled: true })
            .andWhere('(prize.channelId IS NULL OR prize.channelId = :channelId)', {
                channelId: ctx.channelId,
            })
            .andWhere('(prize.stock IS NULL OR prize.stock > 0)')
            .orderBy('prize.sort', 'ASC')
            .addOrderBy('prize.id', 'ASC')
            .getMany();
    }

    /**
     * 当前渠道内启用中奖品数（含全渠道；不含库存过滤——上限约束针对"启用"本身）。
     * excludeId：更新场景排除自身，避免把待启用奖品计入已启用数。
     */
    private countEnabledPrizes(ctx: RequestContext, excludeId?: ID): Promise<number> {
        const qb = this.connection
            .getRepository(ctx, LotteryPrize)
            .createQueryBuilder('prize')
            .where('prize.enabled = :enabled', { enabled: true })
            .andWhere('(prize.channelId IS NULL OR prize.channelId = :channelId)', {
                channelId: ctx.channelId,
            });
        if (excludeId != null) {
            qb.andWhere('prize.id != :excludeId', { excludeId });
        }
        return qb.getCount();
    }

    /** shop：九宫格奖品列表（启用中，含 consume；顺序与开奖 prizeIndex 同源）。未登录可访问。 */
    async myPrizes(ctx: RequestContext): Promise<LotteryPrize[]> {
        return this.enabledPrizes(ctx);
    }

    /**
     * 服务端开奖：按权重随机取奖 → spendPoints 桥扣积分（余额不足抛 UserInputError，事务回滚）
     * → 库存原子递减 → 落抽奖记录。resolver 端 @Transaction() 包裹。
     */
    async draw(ctx: RequestContext): Promise<LotteryDrawResult> {
        const customer = await this.requireCustomer(ctx);
        const prizes = await this.enabledPrizes(ctx);
        if (!prizes.length) {
            throw new UserInputError('Lottery is not configured');
        }
        const total = prizes.reduce((s, p) => s + (p.weight > 0 ? p.weight : 0), 0);
        if (total <= 0) {
            throw new UserInputError('Lottery is not configured');
        }
        let roll = Math.floor(Math.random() * total);
        let picked = prizes[prizes.length - 1];
        let prizeIndex = prizes.length - 1;
        for (let i = 0; i < prizes.length; i++) {
            if (prizes[i].weight <= 0) {
                continue;
            }
            roll -= prizes[i].weight;
            if (roll < 0) {
                picked = prizes[i];
                prizeIndex = i;
                break;
            }
        }

        // 先扣积分（不足即抛、整体回滚），consume=0 视为免费抽奖
        if (picked.consume > 0) {
            const balance = await this.memberService.spendPoints(ctx, customer.id, picked.consume, null, '积分抽奖');
            Logger.info(`Lottery draw customer ${customer.id} spent ${picked.consume} points, balance ${balance}`, loggerCtx);
        }

        // 库存原子递减（camelCase 列必须双引号：postgres 生产 + sqljs 测试双兼容）
        if (picked.stock != null) {
            const decrement = await this.connection
                .getRepository(ctx, LotteryPrize)
                .createQueryBuilder()
                .update(LotteryPrize)
                .set({ stock: () => '"stock" - 1' } as any)
                .where('id = :id', { id: picked.id })
                .andWhere('"stock" > 0')
                .execute();
            if (!decrement.affected) {
                throw new UserInputError('Lottery prize out of stock');
            }
        }

        const repo = this.connection.getRepository(ctx, LotteryRecord);
        await repo.save(
            repo.create({
                customerId: customer.id as number,
                prizeId: picked.id as number,
                prizeName: picked.name,
                prizeImage: picked.image,
                consume: picked.consume,
                channelId: ctx.channelId as number,
                createdAt: new Date(),
            }),
        );
        return { prizeIndex, prize: picked };
    }

    /** shop：我的抽奖记录（customerId + channelId 隔离，id DESC）。 */
    async myRecords(ctx: RequestContext, options?: LotteryRecordListOptions): Promise<PaginatedList<LotteryRecord>> {
        const customer = await this.requireCustomer(ctx);
        return this.listQueryBuilder
            .build(
                LotteryRecord,
                { skip: options?.skip, take: options?.take } as any,
                {
                    ctx,
                    where: { customerId: customer.id as any, channelId: ctx.channelId as any },
                    orderBy: { id: 'DESC' },
                },
            )
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /** admin：奖品分页（当前渠道或全渠道，sort ASC/id ASC）。 */
    async adminPrizes(ctx: RequestContext, options?: LotteryPrizeListOptions): Promise<PaginatedList<LotteryPrize>> {
        const qb = this.listQueryBuilder.build(
            LotteryPrize,
            { skip: options?.skip, take: options?.take } as any,
            { ctx, entityAlias: 'prize', orderBy: { sort: 'ASC', id: 'ASC' } },
        );
        qb.andWhere('(prize.channelId IS NULL OR prize.channelId = :channelId)', { channelId: ctx.channelId });
        return qb.getManyAndCount().then(([items, totalItems]) => ({ items, totalItems }));
    }

    /** admin：全量抽奖记录分页（id DESC）。 */
    async adminRecords(ctx: RequestContext, options?: LotteryRecordListOptions): Promise<PaginatedList<LotteryRecord>> {
        return this.listQueryBuilder
            .build(
                LotteryRecord,
                { skip: options?.skip, take: options?.take } as any,
                { ctx, orderBy: { id: 'DESC' } },
            )
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /** admin：创建奖品（归属当前渠道）。 */
    async createPrize(ctx: RequestContext, input: CreateLotteryPrizeInput): Promise<LotteryPrize> {
        const name = input.name?.trim() ?? '';
        if (!name) {
            throw new UserInputError('name is required');
        }
        const weight = Math.floor(input.weight);
        const consume = Math.floor(input.consume);
        if (!Number.isFinite(weight) || weight < 0) {
            throw new UserInputError('weight must be a non-negative integer');
        }
        if (!Number.isFinite(consume) || consume < 0) {
            throw new UserInputError('consume must be a non-negative integer');
        }
        const enabled = input.enabled ?? true;
        if (enabled && (await this.countEnabledPrizes(ctx)) >= MAX_ENABLED_PRIZES) {
            throw new UserInputError(`Lottery enabled prize limit reached (max ${MAX_ENABLED_PRIZES})`);
        }
        const repo = this.connection.getRepository(ctx, LotteryPrize);
        const saved = await repo.save(
            repo.create({
                name,
                image: input.image ?? null,
                weight,
                consume,
                stock: input.stock ?? null,
                enabled,
                sort: input.sort ?? 0,
                channelId: ctx.channelId as number,
            }),
        );
        Logger.info(`LotteryPrize ${saved.id} created (weight=${saved.weight}, consume=${saved.consume})`, loggerCtx);
        return saved;
    }

    /** admin：更新奖品（仅覆盖传入字段；image/stock 传 null 可清空）。 */
    async updatePrize(ctx: RequestContext, input: UpdateLotteryPrizeInput): Promise<LotteryPrize> {
        const repo = this.connection.getRepository(ctx, LotteryPrize);
        const prize = await repo.findOne({ where: { id: input.id } as any });
        if (!prize) {
            throw new UserInputError(`LotteryPrize ${input.id} not found`);
        }
        if (input.name != null) {
            const name = input.name.trim();
            if (!name) {
                throw new UserInputError('name is required');
            }
            prize.name = name;
        }
        if (input.image !== undefined) {
            prize.image = input.image;
        }
        if (input.weight != null) {
            if (!Number.isFinite(input.weight) || input.weight < 0) {
                throw new UserInputError('weight must be a non-negative integer');
            }
            prize.weight = Math.floor(input.weight);
        }
        if (input.consume != null) {
            if (!Number.isFinite(input.consume) || input.consume < 0) {
                throw new UserInputError('consume must be a non-negative integer');
            }
            prize.consume = Math.floor(input.consume);
        }
        if (input.stock !== undefined) {
            prize.stock = input.stock;
        }
        if (input.enabled != null) {
            prize.enabled = input.enabled;
        }
        if (input.sort != null) {
            prize.sort = Math.floor(input.sort);
        }
        // 本次更新后仍处于启用态（false→true 或本就启用）时校验上限，排除自身计数
        if (prize.enabled && (await this.countEnabledPrizes(ctx, prize.id)) >= MAX_ENABLED_PRIZES) {
            throw new UserInputError(`Lottery enabled prize limit reached (max ${MAX_ENABLED_PRIZES})`);
        }
        const saved = await repo.save(prize);
        Logger.info(`LotteryPrize ${saved.id} updated`, loggerCtx);
        return saved;
    }

    /** admin：删除奖品。 */
    async deletePrize(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, LotteryPrize);
        const prize = await repo.findOne({ where: { id } as any });
        if (!prize) {
            throw new UserInputError(`LotteryPrize ${id} not found`);
        }
        await repo.remove(prize);
        Logger.info(`LotteryPrize ${id} deleted`, loggerCtx);
        return true;
    }
}
