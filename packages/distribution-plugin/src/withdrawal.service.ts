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

    /**
     * 审核状态流转：pending → approved → paid，pending/approved → rejected。
     * 用「带原状态条件的原子更新」完成流转，保证并发或重复调用时只有一次能成功——
     * 否则重复 reject 会对同一笔提现二次回补余额，导致可用余额虚增、冻结余额变负。
     * 调用方（resolver）已包 @Transaction()，此处与余额变更同事务。
     */
    private async transition(
        ctx: RequestContext,
        id: ID,
        from: Array<WithdrawalRequest['status']>,
        patch: Partial<Pick<WithdrawalRequest, 'status' | 'reviewedAt' | 'paidAt'>>,
    ): Promise<WithdrawalRequest> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        const claim = await repo
            .createQueryBuilder()
            .update(WithdrawalRequest)
            .set(patch as any)
            .where('id = :id', { id })
            .andWhere('status IN (:...from)', { from })
            .execute();
        const request = await repo.findOne({ where: { id } as any });
        if (!request) {
            throw new Error(`WithdrawalRequest ${id} not found`);
        }
        if (!claim.affected) {
            throw new UserInputError(
                `Withdrawal request ${id} is ${request.status}, cannot be marked as ${patch.status}`,
            );
        }
        return request;
    }

    async approve(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        const request = await this.transition(ctx, id, ['pending'], { status: 'approved', reviewedAt: new Date() });
        request.accountInfo = decryptAccount(request.accountInfo);
        return request;
    }

    async reject(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        const request = await this.transition(ctx, id, ['pending', 'approved'], { status: 'rejected', reviewedAt: new Date() });

        // 冻结额度退回可用余额。因上面的状态流转只会成功一次，此处不会重复回补。
        const distributor = await this.connection.getEntityOrThrow(ctx, Distributor, request.distributorId);
        distributor.frozenBalance -= request.amount;
        distributor.availableBalance += request.amount;
        await this.connection.getRepository(ctx, Distributor).save(distributor);

        request.accountInfo = decryptAccount(request.accountInfo);
        return request;
    }

    async markPaid(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        const request = await this.transition(ctx, id, ['approved'], { status: 'paid', paidAt: new Date() });

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

        request.accountInfo = decryptAccount(request.accountInfo);
        return request;
    }
}
