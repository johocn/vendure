import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';

import { manageOwnShop } from '@vendure/shop-plugin';

import { MerchantAccount } from './merchant-account.entity';
import { SettlementEntry } from './settlement-entry.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { SettlementService } from './settlement.service';
import { ListOptions, SettlementSummary } from './types';

/** 店主自营后台（ADMIN API）：财务对账 + 提现。归属隔离由 service 按 Shop.administratorId。 */
@Resolver()
export class SettlementShopResolver {
    constructor(private settlementService: SettlementService) {}

    @Query()
    @Allow(manageOwnShop.Permission)
    async myMerchantAccount(@Ctx() ctx: RequestContext): Promise<MerchantAccount> {
        return this.settlementService.myAccount(ctx);
    }

    @Query()
    @Allow(manageOwnShop.Permission)
    async mySettlementEntries(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListOptions,
    ): Promise<{ items: SettlementEntry[]; totalItems: number }> {
        return this.settlementService.mySettlementEntries(ctx, options);
    }

    @Query()
    @Allow(manageOwnShop.Permission)
    async myWithdrawalRequests(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListOptions,
    ): Promise<{ items: WithdrawalRequest[]; totalItems: number }> {
        return this.settlementService.myWithdrawalRequests(ctx, options);
    }

    @Query()
    @Allow(manageOwnShop.Permission)
    async mySettlementSummary(
        @Ctx() ctx: RequestContext,
        @Args('from', { nullable: true }) from: Date,
        @Args('to', { nullable: true }) to: Date,
    ): Promise<SettlementSummary> {
        return this.settlementService.mySettlementSummary(ctx, from, to);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async requestWithdrawal(@Ctx() ctx: RequestContext, @Args('amount') amount: number): Promise<WithdrawalRequest> {
        return this.settlementService.requestWithdrawal(ctx, amount);
    }
}