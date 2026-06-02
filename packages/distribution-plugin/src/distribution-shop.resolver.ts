import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, ListQueryOptions, PaginatedList, RequestContext, Transaction } from '@vendure/core';

import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';

@Resolver()
export class DistributionShopResolver {
    constructor(
        private distributionService: DistributionService,
        private commissionService: CommissionService,
        private withdrawalService: WithdrawalService,
    ) {}

    @Query()
    async myDistributorProfile(
        @Ctx() ctx: RequestContext,
    ): Promise<Distributor | undefined> {
        if (!ctx.activeUserId) return undefined;
        return this.distributionService.findByCustomerId(ctx, ctx.activeUserId as any);
    }

    @Query()
    async myCommissionRecords(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<CommissionRecord>,
    ): Promise<PaginatedList<CommissionRecord>> {
        if (!ctx.activeUserId) return { items: [], totalItems: 0 };
        const distributor = await this.distributionService.findByCustomerId(ctx, ctx.activeUserId as any);
        if (!distributor) return { items: [], totalItems: 0 };
        return this.commissionService.findByDistributor(ctx, distributor.id, options);
    }

    @Query()
    async myWithdrawalRequests(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<WithdrawalRequest>,
    ): Promise<PaginatedList<WithdrawalRequest>> {
        if (!ctx.activeUserId) return { items: [], totalItems: 0 };
        const distributor = await this.distributionService.findByCustomerId(ctx, ctx.activeUserId as any);
        if (!distributor) return { items: [], totalItems: 0 };
        return this.withdrawalService.findByDistributor(ctx, distributor.id, options);
    }

    @Mutation()
    @Transaction()
    async applyDistributor(
        @Ctx() ctx: RequestContext,
        @Args('referredByCode') referredByCode?: string,
    ): Promise<Distributor> {
        if (!ctx.activeUserId) {
            throw new Error('Must be logged in to apply as distributor');
        }
        return this.distributionService.apply(ctx, ctx.activeUserId as any, referredByCode ?? undefined);
    }

    @Mutation()
    @Transaction()
    async requestWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('amount') amount: number,
        @Args('method') method: 'bank' | 'alipay' | 'wechat',
        @Args('accountInfo') accountInfo: string,
    ): Promise<WithdrawalRequest> {
        if (!ctx.activeUserId) {
            throw new Error('Must be logged in to request withdrawal');
        }
        const distributor = await this.distributionService.findByCustomerId(ctx, ctx.activeUserId as any);
        if (!distributor) {
            throw new Error('Not a distributor');
        }
        return this.withdrawalService.request(ctx, distributor.id, amount, method, accountInfo);
    }
}
