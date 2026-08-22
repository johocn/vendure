import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, CustomerService, Ctx, ID, ListQueryOptions, PaginatedList, Permission, RequestContext, Transaction } from '@vendure/core';

import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';

/**
 * 后台结算/打款操作（挂载到 shop-api，供 vshop 后台管理页使用）。
 * 权限由 @Allow 门控（SuperAdmin / 客户读改），模式照搬 marketplace shop.resolver。
 */
@Resolver()
export class DistributionAdminShopResolver {
    constructor(
        private distributionService: DistributionService,
        private commissionService: CommissionService,
        private withdrawalService: WithdrawalService,
        private customerService: CustomerService,
    ) {}

    @Query('distributors')
    @Allow(Permission.SuperAdmin, Permission.ReadCustomer)
    async distributors(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<Distributor>,
    ): Promise<PaginatedList<Distributor & { customerEmail: string | null }>> {
        const list = await this.distributionService.findAll(ctx, options);
        const items = await Promise.all(
            list.items.map(async d => {
                let customerEmail: string | null = null;
                if (d.customerId) {
                    const customer = await this.customerService.findOne(ctx, d.customerId);
                    customerEmail = customer?.emailAddress ?? null;
                }
                return { ...d, customerEmail };
            }),
        );
        return { items, totalItems: list.totalItems };
    }

    @Query('commissionRecords')
    @Allow(Permission.SuperAdmin, Permission.ReadCustomer)
    commissionRecords(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<CommissionRecord>,
    ): Promise<PaginatedList<CommissionRecord>> {
        return this.commissionService.findAll(ctx, options);
    }

    @Query('withdrawalRequests')
    @Allow(Permission.SuperAdmin, Permission.ReadCustomer)
    withdrawalRequests(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<WithdrawalRequest>,
    ): Promise<PaginatedList<WithdrawalRequest>> {
        return this.withdrawalService.findAll(ctx, options);
    }

    @Mutation('settleCommissionsNow')
    @Transaction()
    @Allow(Permission.SuperAdmin, Permission.UpdateCustomer)
    settleCommissionsNow(@Ctx() ctx: RequestContext): Promise<number> {
        return this.commissionService.settlePendingCommissions(ctx);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin, Permission.UpdateCustomer)
    approveDistributor(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Distributor> {
        return this.distributionService.approve(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin, Permission.UpdateCustomer)
    freezeDistributor(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Distributor> {
        return this.distributionService.freeze(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin, Permission.UpdateCustomer)
    approveWithdrawal(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<WithdrawalRequest> {
        return this.withdrawalService.approve(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin, Permission.UpdateCustomer)
    rejectWithdrawal(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<WithdrawalRequest> {
        return this.withdrawalService.reject(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin, Permission.UpdateCustomer)
    markWithdrawalPaid(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<WithdrawalRequest> {
        return this.withdrawalService.markPaid(ctx, id);
    }
}