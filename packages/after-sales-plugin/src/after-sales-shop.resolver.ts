import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { AfterSalesService } from './after-sales.service';

@Resolver()
export class AfterSalesShopResolver {
    constructor(private afterSalesService: AfterSalesService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myAfterSalesRequests(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.afterSalesService.findMyRequests(ctx, options);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async afterSalesRequest(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.findOneForCustomer(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createAfterSalesRequest(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.afterSalesService.createRequest(ctx, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async cancelAfterSalesRequest(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.afterSalesService.cancelRequest(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateReturnTracking(
        @Ctx() ctx: RequestContext,
        @Args('id') id: number,
        @Args('trackingNo') trackingNo: string,
        @Args('carrier') carrier: string,
    ): Promise<any> {
        return this.afterSalesService.updateReturnTracking(ctx, id, trackingNo, carrier);
    }
}
