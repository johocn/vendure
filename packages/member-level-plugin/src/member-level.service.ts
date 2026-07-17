import { Injectable } from '@nestjs/common';
import {
    Customer,
    CustomerService,
    EntityNotFoundError,
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { MemberPointsHistory, PointsHistoryType } from './member-points-history.entity';

export interface MemberInfo {
    customerId: ID;
    level: number;
    levelName: string;
    growthValue: number;
    points: number;
    nextLevelThreshold: number | null;
    nextLevelName: string | null;
}

interface LevelConfig {
    thresholds: number[];
    names: string[];
}

const DEFAULT_THRESHOLDS = [0, 1000, 5000, 20000, 100000];
const DEFAULT_NAMES = ['普通会员', '银卡会员', '金卡会员', '白金会员', '钻石会员'];

@Injectable()
export class MemberLevelService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
    ) {}

    // ===== Public API =====

    async getMemberInfo(ctx: RequestContext, customerId: ID): Promise<MemberInfo> {
        const customer = await this.customerService.findOne(ctx, customerId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', customerId);
        }
        return this.buildMemberInfo(ctx, customer);
    }

    async getMyMemberInfo(ctx: RequestContext): Promise<MemberInfo> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return this.buildMemberInfo(ctx, customer);
    }

    async addGrowthValue(
        ctx: RequestContext,
        customerId: ID,
        amount: number,
        source?: string,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt === 0) {
            throw new UserInputError('amount must be a non-zero integer');
        }
        await this.connection.startTransaction(ctx);
        try {
            const repo = this.connection.getRepository(ctx, Customer);
            const customer = await repo
                .createQueryBuilder('customer')
                .setLock('pessimistic_write')
                .where('customer.id = :id', { id: customerId })
                .getOne();
            if (!customer) {
                throw new EntityNotFoundError('Customer', customerId);
            }
            const cf = (customer as any).customFields ?? {};
            const currentGrowth = cf.growthValue ?? 0;
            const newGrowth = Math.max(0, currentGrowth + amt);
            cf.growthValue = newGrowth;
            const newLevel = this.calculateLevel(ctx, newGrowth);
            cf.memberLevel = newLevel;
            await repo.save(customer);
            await this.connection.commitOpenTransaction(ctx);
            Logger.info(
                `Customer ${customerId} growthValue ${currentGrowth} -> ${newGrowth} (${source ?? ''})`,
                loggerCtx,
            );
            return newGrowth;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    async addPoints(
        ctx: RequestContext,
        customerId: ID,
        amount: number,
        orderId?: ID | null,
        remark?: string | null,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new UserInputError('amount must be a positive integer');
        }
        return this.applyPointsChange(ctx, customerId, amt, PointsHistoryType.EARN, orderId, remark);
    }

    async spendPoints(
        ctx: RequestContext,
        customerId: ID,
        amount: number,
        orderId?: ID | null,
        remark?: string | null,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new UserInputError('amount must be a positive integer');
        }
        return this.applyPointsChange(ctx, customerId, -amt, PointsHistoryType.SPEND, orderId, remark);
    }

    async adjustPoints(
        ctx: RequestContext,
        customerId: ID,
        amount: number,
        remark?: string | null,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt === 0) {
            throw new UserInputError('amount must be a non-zero integer');
        }
        return this.applyPointsChange(
            ctx,
            customerId,
            amt,
            PointsHistoryType.ADJUST,
            undefined,
            remark,
        );
    }

    calculateLevel(ctx: RequestContext, growthValue: number): number {
        const { thresholds } = this.getLevelConfig(ctx);
        let level = 1;
        for (let i = 0; i < thresholds.length; i++) {
            if (growthValue >= thresholds[i]) {
                level = i + 1;
            }
        }
        return level;
    }

    async getMyPointsHistory(
        ctx: RequestContext,
        options?: ListQueryOptions<MemberPointsHistory>,
    ): Promise<PaginatedList<MemberPointsHistory>> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return this.getPointsHistory(ctx, customer.id, options);
    }

    async getPointsHistory(
        ctx: RequestContext,
        customerId: ID,
        options?: ListQueryOptions<MemberPointsHistory>,
    ): Promise<PaginatedList<MemberPointsHistory>> {
        return this.listQueryBuilder
            .build(MemberPointsHistory, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
                where: { customerId: customerId as any },
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async hasPointsRecord(
        ctx: RequestContext,
        customerId: ID,
        orderId: ID,
        type: PointsHistoryType,
    ): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, MemberPointsHistory);
        const count = await repo.count({
            where: { customerId: customerId as any, orderId: Number(orderId), type },
        });
        return count > 0;
    }

    // ===== Internal helpers =====

    private async applyPointsChange(
        ctx: RequestContext,
        customerId: ID,
        delta: number,
        type: PointsHistoryType,
        orderId?: ID | null,
        remark?: string | null,
    ): Promise<number> {
        await this.connection.startTransaction(ctx);
        try {
            const repo = this.connection.getRepository(ctx, Customer);
            const customer = await repo
                .createQueryBuilder('customer')
                .setLock('pessimistic_write')
                .where('customer.id = :id', { id: customerId })
                .getOne();
            if (!customer) {
                throw new EntityNotFoundError('Customer', customerId);
            }
            const cf = (customer as any).customFields ?? {};
            const balanceBefore = cf.points ?? 0;
            const balanceAfter = balanceBefore + delta;
            if (balanceAfter < 0) {
                throw new UserInputError('Insufficient points');
            }
            cf.points = balanceAfter;
            await repo.save(customer);

            const history = new MemberPointsHistory({
                customerId: customerId as any,
                type,
                amount: delta,
                balanceBefore,
                balanceAfter,
                orderId: orderId != null ? Number(orderId) : null,
                remark: remark ?? null,
            });
            history.channels = [ctx.channel];
            await this.connection.getRepository(ctx, MemberPointsHistory).save(history);

            await this.connection.commitOpenTransaction(ctx);
            return balanceAfter;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    private async buildMemberInfo(ctx: RequestContext, customer: Customer): Promise<MemberInfo> {
        const cf = (customer as any).customFields ?? {};
        const growthValue = cf.growthValue ?? 0;
        const points = cf.points ?? 0;
        const level = cf.memberLevel ?? this.calculateLevel(ctx, growthValue);
        const levelName = this.getLevelName(ctx, level);
        const next = this.getNextLevel(ctx, level);
        return {
            customerId: customer.id,
            level,
            levelName,
            growthValue,
            points,
            nextLevelThreshold: next.threshold,
            nextLevelName: next.name,
        };
    }

    private getLevelConfig(ctx: RequestContext): LevelConfig {
        const cf = (ctx.channel as any).customFields ?? {};
        return {
            thresholds: [
                cf.level1Threshold ?? DEFAULT_THRESHOLDS[0],
                cf.level2Threshold ?? DEFAULT_THRESHOLDS[1],
                cf.level3Threshold ?? DEFAULT_THRESHOLDS[2],
                cf.level4Threshold ?? DEFAULT_THRESHOLDS[3],
                cf.level5Threshold ?? DEFAULT_THRESHOLDS[4],
            ],
            names: [
                cf.level1Name ?? DEFAULT_NAMES[0],
                cf.level2Name ?? DEFAULT_NAMES[1],
                cf.level3Name ?? DEFAULT_NAMES[2],
                cf.level4Name ?? DEFAULT_NAMES[3],
                cf.level5Name ?? DEFAULT_NAMES[4],
            ],
        };
    }

    private getLevelName(ctx: RequestContext, level: number): string {
        const { names } = this.getLevelConfig(ctx);
        return names[Math.min(Math.max(level, 1), 5) - 1];
    }

    private getNextLevel(
        ctx: RequestContext,
        level: number,
    ): { threshold: number | null; name: string | null } {
        if (level >= 5) {
            return { threshold: null, name: null };
        }
        const { thresholds, names } = this.getLevelConfig(ctx);
        return { threshold: thresholds[level], name: names[level] };
    }
}
