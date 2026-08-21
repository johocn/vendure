import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { MerchantAccount } from './merchant-account.entity';
import { SettlementEntry } from './settlement-entry.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { SettlementService } from './settlement.service';
import { ListOptions } from './types';

/** 平台管理端（ADMIN API）：全部商户账户/明细/提现审核/佣金配置。 */
@Resolver()
export class SettlementAdminResolver {
    constructor(private settlementService: SettlementService) {}

    @Query()
    @Allow(Permission.UpdateSettings)
    async merchantAccounts(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListOptions,
    ): Promise<{ items: MerchantAccount[]; totalItems: number }> {
        return this.settlementService.accounts(ctx, options);
    }

    @Query()
    @Allow(Permission.UpdateSettings)
    async settlementEntriesByShop(
        @Ctx() ctx: RequestContext,
        @Args('shopId') shopId: ID,
        @Args('options', { nullable: true }) options: ListOptions,
    ): Promise<{ items: SettlementEntry[]; totalItems: number }> {
        return this.settlementService.entriesByShop(ctx, shopId, options);
    }

    @Query()
    @Allow(Permission.UpdateSettings)
    async withdrawalRequests(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListOptions,
    ): Promise<{ items: WithdrawalRequest[]; totalItems: number }> {
        return this.settlementService.allWithdrawalRequests(ctx, options);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async approveWithdrawal(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<WithdrawalRequest> {
        return this.settlementService.approveWithdrawal(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async payWithdrawal(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<WithdrawalRequest> {
        return this.settlementService.payWithdrawal(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async rejectWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('note', { nullable: true }) note: string,
    ): Promise<WithdrawalRequest> {
        return this.settlementService.rejectWithdrawal(ctx, id, note);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async setMerchantCommissionRate(
        @Ctx() ctx: RequestContext,
        @Args('shopId') shopId: ID,
        @Args('rate') rate: number,
    ): Promise<MerchantAccount> {
        return this.settlementService.setMerchantCommissionRate(ctx, shopId, rate);
    }
}