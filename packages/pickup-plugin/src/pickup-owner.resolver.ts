import { Args, Mutation, Parent, Query, Resolver, ResolveProperty } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { manageOwnShop } from '@vendure/shop-plugin';

import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';

@Resolver('PickupRedemption')
export class PickupOwnerResolver {
    constructor(private service: PickupService) {}

    @ResolveProperty('collected')
    collected(@Parent() r: PickupRedemption): boolean {
        return this.service.effectiveCollected(r);
    }

    @Query()
    @Allow(manageOwnShop.Permission)
    async myPickupOrders(@Ctx() ctx: RequestContext, @Args() args: any): Promise<{
        items: PickupRedemption[];
        totalItems: number;
    }> {
        const [items, totalItems] = await this.service.myPickupOrders(ctx, args.options);
        return { items, totalItems };
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async claimPickupByShop(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('collect', { nullable: true }) collect?: boolean,
    ): Promise<PickupRedemption> {
        return this.service.claimPickupByShop(ctx, code, collect);
    }
}