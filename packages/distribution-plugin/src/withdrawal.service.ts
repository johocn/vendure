import { Injectable } from '@nestjs/common';
import { ID, ListQueryBuilder, ListQueryOptions, Logger, PaginatedList, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
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
        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
            throw new UserInputError('Invalid withdrawal amount');
        }
        if (amount < minAmount) {
            throw new UserInputError(`Minimum withdrawal amount is ${minAmount} (cents)`);
        }

        const distributor = await this.distributionService.findOne(ctx, distributorId);
        if (!distributor) {
            throw new UserInputError(`Distributor ${distributorId} not found`);
        }

        // 原子条件扣减：并发提现时只有余额仍充足的那笔能成功，
        // 避免「读余额 → 校验 → 写回」之间的竞态导致多开提现单而余额只扣一次。
        // 列名为 camelCase（TypeORM 用双引号建列），Postgres 下必须显式加双引号，
        // 否则未加引号的标识符会被折叠成小写而报「列不存在」。
        const claim = await this.connection
            .getRepository(ctx, Distributor)
            .createQueryBuilder()
            .update(Distributor)
            .set({
                availableBalance: () => `"availableBalance" - ${amount}`,
                frozenBalance: () => `"frozenBalance" + ${amount}`,
            })
            .where('id = :id', { id: distributor.id })
            .andWhere(`"availableBalance" >= ${amount}`)
            .execute();
        if (claim.affected === 0) {
            throw new UserInputError('Insufficient available balance');
        }

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
