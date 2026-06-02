import { Injectable } from '@nestjs/common';
import { ID, ListQueryBuilder, ListQueryOptions, Logger, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';

import { WithdrawalRequest } from './withdrawal-request.entity';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { loggerCtx } from './constants';

@Injectable()
export class WithdrawalService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private distributionService: DistributionService,
    ) {}

    findAll(ctx: RequestContext, options?: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>> {
        return this.listQueryBuilder
            .build(WithdrawalRequest, options, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels'],
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    findByDistributor(ctx: RequestContext, distributorId: ID, options?: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>> {
        return this.listQueryBuilder
            .build(WithdrawalRequest, options, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels'],
                where: { distributorId } as any,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async request(
        ctx: RequestContext,
        distributorId: ID,
        amount: number,
        method: 'bank' | 'alipay' | 'wechat',
        accountInfo: string,
    ): Promise<WithdrawalRequest> {
        const minAmount = (ctx.channel as any).customFields?.minWithdrawalAmount ?? 10000;
        if (amount < minAmount) {
            throw new Error(`Minimum withdrawal amount is ${minAmount}`);
        }

        const distributor = await this.distributionService.findOne(ctx, distributorId);
        if (!distributor) {
            throw new Error(`Distributor ${distributorId} not found`);
        }

        if (distributor.availableBalance < amount) {
            throw new Error('Insufficient available balance');
        }

        distributor.availableBalance -= amount;
        distributor.frozenBalance += amount;
        await this.connection.getRepository(ctx, Distributor).save(distributor);

        const request = new WithdrawalRequest({
            distributorId,
            amount,
            method,
            accountInfo,
            status: 'pending',
        });
        const channel = await this.connection.getEntityOrThrow(ctx, 'Channel' as any, ctx.channelId);
        request.channels = [channel as any];

        const saved = await this.connection.getRepository(ctx, WithdrawalRequest).save(request);
        Logger.info(`Withdrawal request ${saved.id} created for distributor ${distributorId}, amount ${amount}`, loggerCtx);
        return saved;
    }

    async approve(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        const request = await repo.findOne({ where: { id } as any });
        if (!request) {
            throw new Error(`WithdrawalRequest ${id} not found`);
        }
        request.status = 'approved';
        request.reviewedAt = new Date();
        return repo.save(request);
    }

    async reject(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        const request = await repo.findOne({ where: { id } as any });
        if (!request) {
            throw new Error(`WithdrawalRequest ${id} not found`);
        }
        request.status = 'rejected';
        request.reviewedAt = new Date();

        const distributor = await this.connection.getEntityOrThrow(ctx, Distributor, request.distributorId);
        distributor.frozenBalance -= request.amount;
        distributor.availableBalance += request.amount;
        await this.connection.getRepository(ctx, Distributor).save(distributor);

        return repo.save(request);
    }

    async markPaid(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        const request = await repo.findOne({ where: { id } as any });
        if (!request) {
            throw new Error(`WithdrawalRequest ${id} not found`);
        }
        request.status = 'paid';
        request.paidAt = new Date();

        const distributor = await this.connection.getEntityOrThrow(ctx, Distributor, request.distributorId);
        distributor.frozenBalance -= request.amount;
        await this.connection.getRepository(ctx, Distributor).save(distributor);

        return repo.save(request);
    }
}
