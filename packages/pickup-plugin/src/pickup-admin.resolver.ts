import { Args, Parent, Query, Resolver, ResolveProperty } from '@nestjs/graphql';
import { Allow, Ctx, OrderService, Permission, RequestContext } from '@vendure/core';

import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';

@Resolver('PickupRedemption')
export class PickupAdminResolver {
    constructor(
        private service: PickupService,
        private orderService: OrderService,
    ) {}

    @Query()
    @Allow(Permission.UpdateSettings)
    async pickupRedemptions(@Ctx() ctx: RequestContext, @Args() args: any): Promise<{
        items: PickupRedemption[];
        totalItems: number;
    }> {
        return this.service.allRedemptions(ctx, args.options);
    }

    /** orderCode 无实体内置列，运行时从 Order 反查补全。 */
    @ResolveProperty('orderCode')
    async orderCode(
        @Ctx() ctx: RequestContext,
        @Parent() redemption: PickupRedemption,
    ): Promise<string | null> {
        const order = await this.orderService.findOne(ctx, redemption.orderId);
        return order?.code ?? null;
    }
}