import { Injectable } from '@nestjs/common';
import { Channel, CustomerService, ID, ListQueryBuilder, ListQueryOptions, Logger, PaginatedList, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { Distributor } from './distributor.entity';
import { CommissionRecord } from './commission-record.entity';
import { loggerCtx } from './constants';

@Injectable()
export class DistributionService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
    ) {}

    findAll(ctx: RequestContext, options?: ListQueryOptions<Distributor>): Promise<PaginatedList<Distributor>> {
        return this.listQueryBuilder
            .build(Distributor, options, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels'],
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    findOne(ctx: RequestContext, id: ID): Promise<Distributor | undefined> {
        return this.connection
            .findOneInChannel(ctx, Distributor, id, ctx.channelId, { relations: ['channels'] })
            .then(result => result ?? undefined);
    }

    async findByReferralCode(ctx: RequestContext, referralCode: string): Promise<Distributor | undefined> {
        const repo = this.connection.getRepository(ctx, Distributor);
        const result = await repo
            .createQueryBuilder('distributor')
            .leftJoinAndSelect('distributor.channels', 'channel')
            .where('distributor.referralCode = :referralCode', { referralCode })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .getOne();
        return result ?? undefined;
    }

    async findByCustomerId(ctx: RequestContext, customerId: ID): Promise<Distributor | undefined> {
        const repo = this.connection.getRepository(ctx, Distributor);
        const result = await repo
            .createQueryBuilder('distributor')
            .leftJoinAndSelect('distributor.channels', 'channel')
            .where('distributor.customerId = :customerId', { customerId })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .getOne();
        return result ?? undefined;
    }

    async apply(ctx: RequestContext, customerId: ID, referredByCode?: string): Promise<Distributor> {
        const existing = await this.findByCustomerId(ctx, customerId);
        if (existing) {
            return existing;
        }

        const referralCode = this.generateReferralCode();
        let parentId: ID | undefined;
        let level = 1;

        if (referredByCode) {
            const parent = await this.findByReferralCode(ctx, referredByCode);
            if (parent && parent.status === 'active') {
                parentId = parent.id;
                level = parent.level + 1;
                if (level > 3) {
                    throw new UserInputError('Maximum 3 levels of distribution relationship allowed');
                }
            }
        }

        const distributor = new Distributor({
            customerId: String(customerId),
            parentId: parentId != null ? String(parentId) : null,
            level,
            status: 'pending',
            totalEarnings: 0,
            availableBalance: 0,
            frozenBalance: 0,
            referralCode,
        });

        const channel = await this.connection.getEntityOrThrow(ctx, Channel, ctx.channelId);
        distributor.channels = [channel];

        const saved = await this.connection.getRepository(ctx, Distributor).save(distributor);

        // 回写 customer.customFields.referralCode（自己的码）与 referredBy（推荐人的码）
        try {
            const customer = await this.customerService.findOne(ctx, customerId);
            if (customer) {
                await this.customerService.update(ctx, {
                    id: customer.id,
                    customFields: {
                        referralCode: saved.referralCode,
                        ...(referredByCode ? { referredBy: referredByCode } : {}),
                    },
                } as any);
            }
        } catch (e: any) {
            // 回写失败不影响分销商创建
            Logger.warn(`Failed to write back referralCode to customer ${customerId}: ${e.message}`, loggerCtx);
        }

        return saved;
    }

    async approve(ctx: RequestContext, id: ID): Promise<Distributor> {
        const distributor = await this.findOne(ctx, id);
        if (!distributor) {
            throw new Error(`Distributor ${id} not found`);
        }
        distributor.status = 'active';
        return this.connection.getRepository(ctx, Distributor).save(distributor);
    }

    async freeze(ctx: RequestContext, id: ID): Promise<Distributor> {
        const distributor = await this.findOne(ctx, id);
        if (!distributor) {
            throw new Error(`Distributor ${id} not found`);
        }
        distributor.status = 'frozen';
        return this.connection.getRepository(ctx, Distributor).save(distributor);
    }

    generateReferralCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async getTeamSummary(ctx: RequestContext, distributorId: ID): Promise<TeamSummary> {
        const repo = this.connection.getRepository(ctx, Distributor);
        const channelId = ctx.channelId;

        // 直推下级：parentId = 当前分销员（限当前 channel）
        const directChildren = await repo
            .createQueryBuilder('d')
            .innerJoin('d.channels', 'channel')
            .where('d.parentId = :pid', { pid: String(distributorId) })
            .andWhere('channel.id = :channelId', { channelId })
            .getMany();
        const directIds = directChildren.map(c => c.id);
        const directTeamSize = directChildren.length;

        // 间推下级：parentId ∈ 直推 ids（限当前 channel）
        let indirectTeamSize = 0;
        if (directIds.length) {
            indirectTeamSize = await repo
                .createQueryBuilder('d')
                .innerJoin('d.channels', 'channel')
                .where('d.parentId IN (:...ids)', { ids: directIds.map(String) })
                .andWhere('channel.id = :channelId', { channelId })
                .getCount();
        }

        // 当前分销员带来的订单与收益（仅 confirmed/paid，避免 pending 未结算虚高）
        const crRepo = this.connection.getRepository(ctx, CommissionRecord);
        const rows = await crRepo
            .createQueryBuilder('cr')
            .select('COUNT(DISTINCT cr.orderId)', 'orderCount')
            .addSelect('COALESCE(SUM(cr.orderAmount),0)', 'orderAmount')
            .addSelect('COALESCE(SUM(cr.commissionAmount),0)', 'commission')
            .where('cr.distributorId = :did', { did: String(distributorId) })
            .andWhere('cr.status IN (:...s)', { s: ['confirmed', 'paid'] })
            .getRawOne();

        return {
            directTeamSize,
            indirectTeamSize,
            totalTeamSize: directTeamSize + indirectTeamSize,
            orderCount: Number(rows?.orderCount ?? 0),
            orderAmount: Number(rows?.orderAmount ?? 0),
            teamCommission: Number(rows?.commission ?? 0),
        };
    }
}

export interface TeamSummary {
    directTeamSize: number;
    indirectTeamSize: number;
    totalTeamSize: number;
    orderCount: number;
    orderAmount: number;
    teamCommission: number;
}
