import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, PaginatedList, Permission, RequestContext, Transaction } from '@vendure/core';

import { PointsMallService } from './points-mall.service';
import { PointsOrder } from './points-order.entity';
import { PointsProduct } from './points-product.entity';
import { PointsOrderListOptions, PointsProductListOptions } from './types';

@Resolver()
export class PointsMallAdminResolver {
    constructor(private pointsMallService: PointsMallService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async pointsProductsAdmin(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: PointsProductListOptions,
    ): Promise<PaginatedList<PointsProduct>> {
        return this.pointsMallService.adminPointsProducts(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadSettings)
    async pointsOrdersAdmin(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: PointsOrderListOptions,
    ): Promise<PaginatedList<PointsOrder>> {
        return this.pointsMallService.adminPointsOrders(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async createPointsProduct(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<PointsProduct> {
        return this.pointsMallService.createPointsProduct(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async updatePointsProduct(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<PointsProduct> {
        return this.pointsMallService.updatePointsProduct(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async deletePointsProduct(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.pointsMallService.deletePointsProduct(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async markPointsOrderPaid(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<PointsOrder> {
        return this.pointsMallService.markPointsOrderPaid(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async markPointsOrderShipped(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('trackingNo', { nullable: true }) trackingNo?: string,
    ): Promise<PointsOrder> {
        return this.pointsMallService.markPointsOrderShipped(ctx, id, trackingNo);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async markPointsOrderCompleted(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<PointsOrder> {
        return this.pointsMallService.markPointsOrderCompleted(ctx, id);
    }
}
