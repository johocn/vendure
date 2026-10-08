import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, Order, RequestContext, Transaction } from '@vendure/core';

import { RentalPlan } from './rental-plan.entity';
import { RentalService } from './rental.service';

@Resolver()
export class RentalShopResolver {
    constructor(private rentalService: RentalService) {}

    @Query()
    rentalPlans(@Ctx() ctx: RequestContext, @Args('variantId') variantId: ID): Promise<RentalPlan[]> {
        return this.rentalService.findByVariant(ctx, variantId);
    }

    @Mutation()
    @Transaction()
    startRental(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('planId') planId: ID,
        @Args('periods', { nullable: true }) periods?: number,
    ): Promise<Order> {
        return this.rentalService.startRental(ctx, orderId, planId, periods ?? 1);
    }

    @Mutation()
    @Transaction()
    buyoutRental(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
    ): Promise<{ scheduleId: number; seq: number; amount: number }> {
        return this.rentalService.buyoutRental(ctx, orderId);
    }
}
