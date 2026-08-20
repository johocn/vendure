import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { OrderPackageService } from './order-package.service';

@Resolver()
export class OrderPackageShopResolver {
    constructor(private orderPackageService: OrderPackageService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myOrderPackages(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: string,
    ) {
        return this.orderPackageService.getMyOrderPackages(ctx, orderId as any);
    }

    /** C端确认收货：本人订单 Delivered → Completed（归属校验 + 幂等） */
    @Mutation()
    @Allow(Permission.Authenticated)
    async confirmOrderReceipt(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: string,
    ): Promise<boolean> {
        return this.orderPackageService.confirmOrderReceipt(ctx, orderId as any);
    }
}
