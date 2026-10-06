import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { AfterSalesService } from './after-sales.service';

@Resolver()
export class AfterSalesAdminResolver {
    constructor(private afterSalesService: AfterSalesService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async afterSalesRequests(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.afterSalesService.findAll(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async afterSalesRequestAdmin(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.findOneForAdmin(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async afterSalesReturnAddress(@Ctx() ctx: RequestContext): Promise<string> {
        return this.afterSalesService.getReturnAddress(ctx);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async updateAfterSalesReturnAddress(@Ctx() ctx: RequestContext, @Args('address') address: string): Promise<boolean> {
        return this.afterSalesService.updateReturnAddress(ctx, address);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async batchApproveAfterSalesRequests(
        @Ctx() ctx: RequestContext,
        @Args('ids', { type: () => [ID] }) ids: number[],
    ): Promise<any> {
        return this.afterSalesService.batchApprove(ctx, ids);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async batchRejectAfterSalesRequests(
        @Ctx() ctx: RequestContext,
        @Args('ids', { type: () => [ID] }) ids: number[],
        @Args('reason') reason: string,
    ): Promise<any> {
        return this.afterSalesService.batchReject(ctx, ids, reason);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async approveAfterSalesRequest(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.approveRequest(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async rejectAfterSalesRequest(
        @Ctx() ctx: RequestContext,
        @Args('id') id: number,
        @Args('reason') reason: string,
    ): Promise<any> {
        return this.afterSalesService.rejectRequest(ctx, id, reason);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async confirmReturnReceived(
        @Ctx() ctx: RequestContext,
        @Args('id') id: number,
        @Args('receivedQuantity', { nullable: true, type: () => Number }) receivedQuantity?: number,
    ): Promise<any> {
        return this.afterSalesService.confirmReceive(ctx, id, receivedQuantity);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async processAfterSalesRefund(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.processRefund(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async retryAfterSalesRefund(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.retryRefund(ctx, id);
    }
}
