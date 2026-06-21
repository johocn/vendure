import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { AfterSalesService } from './after-sales.service';

@Resolver()
export class AfterSalesAdminResolver {
    constructor(private afterSalesService: AfterSalesService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async afterSalesRequests(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.afterSalesService.findAll(ctx, options);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async approveAfterSalesRequest(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.approveRequest(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async rejectAfterSalesRequest(
        @Ctx() ctx: RequestContext,
        @Args('id') id: number,
        @Args('reason') reason: string,
    ): Promise<any> {
        return this.afterSalesService.rejectRequest(ctx, id, reason);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async confirmReturnReceived(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.confirmReceive(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async processAfterSalesRefund(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.processRefund(ctx, id);
    }
}
