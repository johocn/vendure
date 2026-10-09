import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, PaginatedList, Permission, RequestContext, Transaction } from '@vendure/core';

import { BalanceWithdrawalRequest } from './balance-withdrawal-request.entity';
import { BalanceWithdrawalService } from './balance-withdrawal.service';

@Resolver()
export class BalanceWithdrawalShopResolver {
    constructor(private balanceWithdrawalService: BalanceWithdrawalService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myBalanceWithFrozen(
        @Ctx() ctx: RequestContext,
    ): Promise<{ balance: number; frozenBalance: number }> {
        return this.balanceWithdrawalService.myBalance(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myBalanceWithdrawals(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: { skip?: number; take?: number },
    ): Promise<PaginatedList<BalanceWithdrawalRequest>> {
        return this.balanceWithdrawalService.findMyRequests(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async requestBalanceWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('amount') amount: number,
        @Args('method') method: 'wechat' | 'alipay' | 'bank',
        @Args('accountInfo') accountInfo: string,
    ): Promise<BalanceWithdrawalRequest> {
        return this.balanceWithdrawalService.request(ctx, amount, method, accountInfo);
    }
}

@Resolver()
export class BalanceWithdrawalAdminResolver {
    constructor(private balanceWithdrawalService: BalanceWithdrawalService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async balanceWithdrawals(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: { skip?: number; take?: number; status?: string },
    ): Promise<PaginatedList<BalanceWithdrawalRequest>> {
        return this.balanceWithdrawalService.findAll(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async approveBalanceWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('remark', { nullable: true }) remark?: string,
    ): Promise<BalanceWithdrawalRequest> {
        return this.balanceWithdrawalService.approve(ctx, id, remark);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async rejectBalanceWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('remark', { nullable: true }) remark?: string,
    ): Promise<BalanceWithdrawalRequest> {
        return this.balanceWithdrawalService.reject(ctx, id, remark);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async markBalanceWithdrawalPaid(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<BalanceWithdrawalRequest> {
        return this.balanceWithdrawalService.markPaid(ctx, id);
    }
}
