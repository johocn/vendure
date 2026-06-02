import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, ListQueryOptions, PaginatedList, RequestContext, Transaction } from '@vendure/core';

import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';

@Resolver()
export class DistributionAdminResolver {
    constructor(
        private distributionService: DistributionService,
        private commissionService: CommissionService,
        private withdrawalService: WithdrawalService,
    ) {}

    @Query()
    async distributors(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<Distributor>,
    ): Promise<PaginatedList<Distributor>> {
        return this.distributionService.findAll(ctx, options);
    }

    @Query()
    async commissionRecords(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<CommissionRecord>,
    ): Promise<PaginatedList<CommissionRecord>> {
        return this.commissionService.findAll(ctx, options);
    }

    @Query()
    async withdrawalRequests(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<WithdrawalRequest>,
    ): Promise<PaginatedList<WithdrawalRequest>> {
        return this.withdrawalService.findAll(ctx, options);
    }

    @Mutation()
    @Transaction()
    async approveDistributor(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<Distributor> {
        return this.distributionService.approve(ctx, id);
    }

    @Mutation()
    @Transaction()
    async freezeDistributor(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<Distributor> {
        return this.distributionService.freeze(ctx, id);
    }

    @Mutation()
    @Transaction()
    async approveWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<WithdrawalRequest> {
        return this.withdrawalService.approve(ctx, id);
    }

    @Mutation()
    @Transaction()
    async rejectWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<WithdrawalRequest> {
        return this.withdrawalService.reject(ctx, id);
    }

    @Mutation()
    @Transaction()
    async markWithdrawalPaid(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<WithdrawalRequest> {
        return this.withdrawalService.markPaid(ctx, id);
    }
}
