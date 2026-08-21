import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';

@Resolver('PickupRedemption')
export class PickupCustomerResolver {
    constructor(private service: PickupService) {}

    @Query()
    @Allow(Permission.Owner)
    async myPickupCode(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID): Promise<PickupRedemption> {
        return this.service.resolveMyPickupCode(ctx, orderId);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async claimMyPickup(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('code') code: string,
    ): Promise<PickupRedemption> {
        return this.service.claimMyPickup(ctx, orderId, code);
    }
}