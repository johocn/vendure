import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CustomerService, Ctx, ID, ListQueryOptions, PaginatedList, RequestContext, Transaction } from '@vendure/core';

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
        private customerService: CustomerService,
    ) {}

    /**
     * shop-api 会话的 ctx.activeUserId 是 User 的 id，而 Distributor.customerId 存的是 Customer 的 id，
     * 二者数字空间重叠会错配。统一经 findOneByUserId 解析出真实 customer id。
     */
    private async resolveCustomerId(ctx: RequestContext): Promise<ID | undefined> {
        if (!ctx.activeUserId) return undefined;
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId as ID);
        return customer?.id;
    }

    @Query()
    async myDistributorProfile(
        @Ctx() ctx: RequestContext,
    ): Promise<Distributor | undefined> {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) return undefined;
        return this.distributionService.findByCustomerId(ctx, customerId);
    }

    @Query()
    async myCommissionRecords(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<CommissionRecord>,
    ): Promise<PaginatedList<CommissionRecord>> {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) return { items: [], totalItems: 0 };
        const distributor = await this.distributionService.findByCustomerId(ctx, customerId);
        if (!distributor) return { items: [], totalItems: 0 };
        return this.commissionService.findByDistributor(ctx, distributor.id, options);
    }

    @Query()
    async myWithdrawalRequests(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<WithdrawalRequest>,
    ): Promise<PaginatedList<WithdrawalRequest>> {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) return { items: [], totalItems: 0 };
        const distributor = await this.distributionService.findByCustomerId(ctx, customerId);
        if (!distributor) return { items: [], totalItems: 0 };
        return this.withdrawalService.findByDistributor(ctx, distributor.id, options);
    }

    @Mutation()
    @Transaction()
    async applyDistributor(
        @Ctx() ctx: RequestContext,
        @Args('referredByCode') referredByCode?: string,
    ): Promise<Distributor> {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            throw new Error('Must be logged in to apply as distributor');
        }
        return this.distributionService.apply(ctx, customerId, referredByCode ?? undefined);
    }

    @Mutation()
    @Transaction()
    async requestWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('amount') amount: number,
        @Args('method') method: 'bank' | 'alipay' | 'wechat',
        @Args('accountInfo') accountInfo: string,
    ): Promise<WithdrawalRequest> {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            throw new Error('Must be logged in to request withdrawal');
        }
        const distributor = await this.distributionService.findByCustomerId(ctx, customerId);
        if (!distributor) {
            throw new Error('Not a distributor');
        }
        return this.withdrawalService.request(ctx, distributor.id, amount, method, accountInfo);
    }
}
