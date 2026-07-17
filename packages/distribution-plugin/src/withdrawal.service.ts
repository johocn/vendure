import { Injectable } from '@nestjs/common';
import { ID, ListQueryBuilder, ListQueryOptions, Logger, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { decryptAccount, encryptAccount } from './account-crypto';
import { CommissionRecord } from './commission-record.entity';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { loggerCtx } from './constants';
import { WithdrawalRequest } from './withdrawal-request.entity';

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
            .then(([items, totalItems]) => {
                items.forEach(item => {
                    item.accountInfo = decryptAccount(item.accountInfo);
                });
                return { items, totalItems };
            });
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
            .then(([items, totalItems]) => {
                items.forEach(item => {
                    item.accountInfo = decryptAccount(item.accountInfo);
                });
                return { items, totalItems };
            });
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
            distributorId: String(distributorId),
            amount,
            method,
            accountInfo: encryptAccount(accountInfo),
            status: 'pending',
        });
        const channel = await this.connection.getEntityOrThrow(ctx, 'Channel' as any, ctx.channelId);
        request.channels = [channel as any];

        const saved = await this.connection.getRepository(ctx, WithdrawalRequest).save(request);
        saved.accountInfo = decryptAccount(saved.accountInfo);
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
        const saved = await repo.save(request);
        saved.accountInfo = decryptAccount(saved.accountInfo);
        return saved;
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

        const saved = await repo.save(request);
        saved.accountInfo = decryptAccount(saved.accountInfo);
        return saved;
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

        // 联动 CommissionRecord：将该分销商 pending/confirmed 佣金记录置 paid
        const commissionRepo = this.connection.getRepository(ctx, CommissionRecord);
        const pendingRecords = await commissionRepo.find({
            where: {
                distributorId: request.distributorId,
                status: In(['pending', 'confirmed']) as any,
            } as any,
        });
        for (const record of pendingRecords) {
            record.status = 'paid';
            await commissionRepo.save(record);
        }
        if (pendingRecords.length > 0) {
            Logger.info(`Marked ${pendingRecords.length} commission records as paid for distributor ${request.distributorId}`, loggerCtx);
        }

        const saved = await repo.save(request);
        saved.accountInfo = decryptAccount(saved.accountInfo);
        return saved;
    }
}
