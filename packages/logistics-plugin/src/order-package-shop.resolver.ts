import { Args, Query, Resolver } from '@nestjs/graphql';
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
}
