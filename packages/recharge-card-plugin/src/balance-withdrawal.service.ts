import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    ID,
    ListQueryBuilder,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { BalanceTransaction, BalanceTransactionType } from './balance-transaction.entity';
import { BalanceWithdrawalRequest } from './balance-withdrawal-request.entity';
import { loggerCtx } from './constants';
import { CustomerBalance } from './customer-balance.entity';

const MIN_WITHDRAWAL_AMOUNT = 1000; // 分，¥10 起提

@Injectable()
export class BalanceWithdrawalService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
    ) {}

    /**
     * 与 RechargeCardService.resolveCustomerId 同款口径：经 customerService.findOneByUserId
     * 把会话的 User.id 解析成 Customer.id，保证与既有余额键一致
     * （User.id vs Customer.id 混用会导致同一账户余额/流水分裂）。
     */
    private async resolveCustomerId(ctx: RequestContext): Promise<number> {
        if (!ctx.activeUserId) {
            throw new UserInputError('Must be logged in');
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new UserInputError('Customer not found');
        }
        return Number(customer.id);
    }

    async myBalance(ctx: RequestContext): Promise<{ balance: number; frozenBalance: number }> {
        const cid = await this.resolveCustomerId(ctx);
        const row = await this.connection
            .getRepository(ctx, CustomerBalance)
            .findOne({ where: { customerId: cid, channelId: ctx.channelId as any } });
        return { balance: row?.balance ?? 0, frozenBalance: row?.frozenBalance ?? 0 };
    }

    async findMyRequests(
        ctx: RequestContext,
        options?: { skip?: number; take?: number },
    ): Promise<PaginatedList<BalanceWithdrawalRequest>> {
        const cid = await this.resolveCustomerId(ctx);
        // 渠道/客户维度并入标准 filter 交给 ListQueryBuilder 统一转义（同包 scopedOptions 口径，
        // 手写 andWhere 不加引号在 Postgres 会被折叠成小写报「列不存在」）
        return this.listQueryBuilder
            .build(
                BalanceWithdrawalRequest,
                {
                    skip: options?.skip,
                    take: options?.take,
                    filter: { channelId: { eq: ctx.channelId }, customerId: { eq: cid } },
                } as any,
                { ctx },
            )
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findAll(
        ctx: RequestContext,
        options?: { skip?: number; take?: number; status?: string },
    ): Promise<PaginatedList<BalanceWithdrawalRequest>> {
        const filter: any = { channelId: { eq: ctx.channelId } };
        if (options?.status) {
            filter.status = { eq: options.status };
        }
        return this.listQueryBuilder
            .build(
                BalanceWithdrawalRequest,
                { skip: options?.skip, take: options?.take, filter } as any,
                { ctx },
            )
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /**
     * 申请提现：原子条件扣减 balance 并入 frozenBalance（仿 distribution withdrawal.service.ts:77-90）。
     * 并发申请时只有余额仍充足的那笔能成功，避免「读余额 → 校验 → 写回」竞态多开提现单。
     */
    async request(
        ctx: RequestContext,
        amount: number,
        method: 'wechat' | 'alipay' | 'bank',
        accountInfo: string,
    ): Promise<BalanceWithdrawalRequest> {
        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
            throw new UserInputError('Invalid withdrawal amount');
        }
        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            throw new UserInputError(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT} (cents)`);
        }
        if (!accountInfo?.trim()) {
            throw new UserInputError('accountInfo is required');
        }
        const cid = await this.resolveCustomerId(ctx);

        const balanceRepo = this.connection.getRepository(ctx, CustomerBalance);
        const row = await balanceRepo.findOne({
            where: { customerId: cid, channelId: ctx.channelId as any },
        });
        if (!row) {
            throw new UserInputError('Insufficient balance');
        }

        // 原子条件扣减：列名为 camelCase（TypeORM 建列带双引号），Postgres 下必须显式加双引号，
        // 否则未加引号的标识符被折叠成小写而报「列不存在」。
        const claim = await balanceRepo
            .createQueryBuilder()
            .update(CustomerBalance)
            .set({
                balance: () => `"balance" - ${amount}`,
                frozenBalance: () => `"frozenBalance" + ${amount}`,
            })
            .where('id = :id', { id: row.id })
            .andWhere(`"balance" >= ${amount}`)
            .execute();
        if (claim.affected === 0) {
            throw new UserInputError('Insufficient balance');
        }

        const after = await balanceRepo.findOneByOrFail({ id: row.id });
        await this.connection.getRepository(ctx, BalanceTransaction).save({
            customerId: cid,
            channelId: ctx.channelId,
            type: BalanceTransactionType.FREEZE,
            amount: -amount,
            balanceBefore: row.balance,
            balanceAfter: after.balance,
            remark: '提现冻结',
        } as any);

        const saved = await this.connection.getRepository(ctx, BalanceWithdrawalRequest).save({
            customerId: cid,
            amount,
            method,
            accountInfo: accountInfo.trim(),
            status: 'pending',
            channelId: ctx.channelId,
        } as any);
        Logger.info(`Balance withdrawal ${saved.id} requested by customer ${cid}, amount ${amount}`, loggerCtx);
        return saved;
    }

    /**
     * 审核状态流转：pending → approved → paid，pending/approved → rejected。
     * 用「带原状态条件的原子更新」完成流转（仿 distribution withdrawal.service.ts:114-138），
     * 保证并发或重复调用时只有一次能成功——否则重复 reject 会对同一笔提现二次回补余额。
     * 调用方（resolver）已包 @Transaction()，此处与余额变更同事务。
     */
    private async transition(
        ctx: RequestContext,
        id: ID,
        from: Array<BalanceWithdrawalRequest['status']>,
        patch: Partial<Pick<BalanceWithdrawalRequest, 'status' | 'reviewedAt' | 'paidAt' | 'remark'>>,
    ): Promise<BalanceWithdrawalRequest> {
        const repo = this.connection.getRepository(ctx, BalanceWithdrawalRequest);
        const claim = await repo
            .createQueryBuilder()
            .update(BalanceWithdrawalRequest)
            .set(patch as any)
            .where('id = :id', { id })
            .andWhere('status IN (:...from)', { from })
            .execute();
        const request = await repo.findOne({ where: { id } as any });
        if (!request) {
            throw new Error(`BalanceWithdrawalRequest ${id} not found`);
        }
        if (!claim.affected) {
            throw new UserInputError(
                `Withdrawal request ${id} is ${request.status}, cannot be marked as ${patch.status}`,
            );
        }
        return request;
    }

    async approve(ctx: RequestContext, id: ID, remark?: string): Promise<BalanceWithdrawalRequest> {
        return this.transition(ctx, id, ['pending'], {
            status: 'approved',
            reviewedAt: new Date(),
            remark: remark ?? null,
        });
    }

    /** 驳回：解冻回补 balance，写 UNFREEZE 流水（transition 只成功一次 → 不会重复回补） */
    async reject(ctx: RequestContext, id: ID, remark?: string): Promise<BalanceWithdrawalRequest> {
        const request = await this.transition(ctx, id, ['pending', 'approved'], {
            status: 'rejected',
            reviewedAt: new Date(),
            remark: remark ?? '驳回',
        });

        const balanceRepo = this.connection.getRepository(ctx, CustomerBalance);
        const row = await balanceRepo.findOneByOrFail({
            customerId: request.customerId,
            channelId: request.channelId as any,
        });
        const before = row.balance;
        row.frozenBalance -= request.amount;
        row.balance += request.amount;
        await balanceRepo.save(row);

        await this.connection.getRepository(ctx, BalanceTransaction).save({
            customerId: request.customerId,
            channelId: request.channelId,
            type: BalanceTransactionType.UNFREEZE,
            amount: request.amount,
            balanceBefore: before,
            balanceAfter: row.balance,
            remark: '提现驳回退回',
        } as any);
        Logger.info(`Balance withdrawal ${request.id} rejected, refunded ${request.amount} to customer ${request.customerId}`, loggerCtx);
        return request;
    }

    /** 打款完成：冻结出账（balance 不变，无流水） */
    async markPaid(ctx: RequestContext, id: ID): Promise<BalanceWithdrawalRequest> {
        const request = await this.transition(ctx, id, ['approved'], { status: 'paid', paidAt: new Date() });

        const balanceRepo = this.connection.getRepository(ctx, CustomerBalance);
        const row = await balanceRepo.findOneByOrFail({
            customerId: request.customerId,
            channelId: request.channelId as any,
        });
        row.frozenBalance -= request.amount;
        await balanceRepo.save(row);

        Logger.info(`Balance withdrawal ${request.id} marked paid, cleared ${request.amount} frozen for customer ${request.customerId}`, loggerCtx);
        return request;
    }
}
