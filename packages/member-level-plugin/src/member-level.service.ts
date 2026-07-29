import { Injectable } from '@nestjs/common';
import {
    ChannelService,
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

export interface ChannelLevelConfig {
    level1Threshold: number;
    level1Name: string;
    level2Threshold: number;
    level2Name: string;
    level3Threshold: number;
    level3Name: string;
    level4Threshold: number;
    level4Name: string;
    level5Threshold: number;
    level5Name: string;
    pointsEarnRatio: number;
    pointsEarnOnShipping: boolean;
}

export interface MemberListItem {
    customerId: ID;
    emailAddress: string | null;
    firstName: string | null;
    lastName: string | null;
    level: number;
    levelName: string;
    growthValue: number;
    points: number;
    createdAt: Date;
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
        private channelService: ChannelService,
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
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, Customer);
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
            const newLevel = this.calculateLevel(txCtx, newGrowth);
            cf.memberLevel = newLevel;
            await repo.save(customer);
            Logger.info(
                `Customer ${customerId} growthValue ${currentGrowth} -> ${newGrowth} (${source ?? ''})`,
                loggerCtx,
            );
            return newGrowth;
        });
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
        const { thresholds } = this.getLevelThresholds(ctx);
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

    async findAllMembers(
        ctx: RequestContext,
        options?: { skip?: number; take?: number; filter?: { emailAddress?: string; level?: number } },
    ): Promise<PaginatedList<MemberListItem>> {
        const listOptions: ListQueryOptions<Customer> = {};
        if (options) {
            if (options.skip != null) listOptions.skip = options.skip;
            if (options.take != null) listOptions.take = options.take;
            if (options.filter) {
                const filter: any = {};
                if (options.filter.emailAddress) {
                    filter.emailAddress = { contains: options.filter.emailAddress };
                }
                if (options.filter.level != null) {
                    filter.customFields = { memberLevel: { eq: options.filter.level } };
                }
                if (Object.keys(filter).length > 0) {
                    listOptions.filter = filter;
                }
            }
        }
        const [customers, totalItems] = await this.listQueryBuilder
            .build(Customer, listOptions, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount();
        const items = customers.map((c) => {
            const cf = (c as any).customFields ?? {};
            const level = cf.memberLevel ?? 1;
            return {
                customerId: c.id,
                emailAddress: c.emailAddress,
                firstName: c.firstName,
                lastName: c.lastName,
                level,
                levelName: this.getLevelName(ctx, level),
                growthValue: cf.growthValue ?? 0,
                points: cf.points ?? 0,
                createdAt: c.createdAt,
            } as MemberListItem;
        });
        return { items, totalItems };
    }

    getLevelConfig(ctx: RequestContext): ChannelLevelConfig {
        const cf = (ctx.channel as any).customFields ?? {};
        return {
            level1Threshold: cf.level1Threshold ?? DEFAULT_THRESHOLDS[0],
            level1Name: cf.level1Name ?? DEFAULT_NAMES[0],
            level2Threshold: cf.level2Threshold ?? DEFAULT_THRESHOLDS[1],
            level2Name: cf.level2Name ?? DEFAULT_NAMES[1],
            level3Threshold: cf.level3Threshold ?? DEFAULT_THRESHOLDS[2],
            level3Name: cf.level3Name ?? DEFAULT_NAMES[2],
            level4Threshold: cf.level4Threshold ?? DEFAULT_THRESHOLDS[3],
            level4Name: cf.level4Name ?? DEFAULT_NAMES[3],
            level5Threshold: cf.level5Threshold ?? DEFAULT_THRESHOLDS[4],
            level5Name: cf.level5Name ?? DEFAULT_NAMES[4],
            pointsEarnRatio: cf.pointsEarnRatio ?? 1,
            pointsEarnOnShipping: cf.pointsEarnOnShipping ?? false,
        };
    }

    async updateLevelConfig(ctx: RequestContext, input: Partial<ChannelLevelConfig>): Promise<ChannelLevelConfig> {
        await this.channelService.update(ctx, {
            id: ctx.channelId,
            customFields: {
                level1Threshold: input.level1Threshold,
                level1Name: input.level1Name,
                level2Threshold: input.level2Threshold,
                level2Name: input.level2Name,
                level3Threshold: input.level3Threshold,
                level3Name: input.level3Name,
                level4Threshold: input.level4Threshold,
                level4Name: input.level4Name,
                level5Threshold: input.level5Threshold,
                level5Name: input.level5Name,
                pointsEarnRatio: input.pointsEarnRatio,
                pointsEarnOnShipping: input.pointsEarnOnShipping,
            },
        } as any);
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        const cf = (channel as any)?.customFields ?? (ctx.channel as any).customFields ?? {};
        return {
            level1Threshold: cf.level1Threshold ?? DEFAULT_THRESHOLDS[0],
            level1Name: cf.level1Name ?? DEFAULT_NAMES[0],
            level2Threshold: cf.level2Threshold ?? DEFAULT_THRESHOLDS[1],
            level2Name: cf.level2Name ?? DEFAULT_NAMES[1],
            level3Threshold: cf.level3Threshold ?? DEFAULT_THRESHOLDS[2],
            level3Name: cf.level3Name ?? DEFAULT_NAMES[2],
            level4Threshold: cf.level4Threshold ?? DEFAULT_THRESHOLDS[3],
            level4Name: cf.level4Name ?? DEFAULT_NAMES[3],
            level5Threshold: cf.level5Threshold ?? DEFAULT_THRESHOLDS[4],
            level5Name: cf.level5Name ?? DEFAULT_NAMES[4],
            pointsEarnRatio: cf.pointsEarnRatio ?? 1,
            pointsEarnOnShipping: cf.pointsEarnOnShipping ?? false,
        };
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
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, Customer);
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
            history.channelId = txCtx.channelId as number;
            history.channels = [txCtx.channel];
            await this.connection.getRepository(txCtx, MemberPointsHistory).save(history);

            return balanceAfter;
        });
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

    private getLevelThresholds(ctx: RequestContext): LevelConfig {
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
        const { names } = this.getLevelThresholds(ctx);
        return names[Math.min(Math.max(level, 1), 5) - 1];
    }

    private getNextLevel(
        ctx: RequestContext,
        level: number,
    ): { threshold: number | null; name: string | null } {
        if (level >= 5) {
            return { threshold: null, name: null };
        }
        const { thresholds, names } = this.getLevelThresholds(ctx);
        return { threshold: thresholds[level], name: names[level] };
    }
}
