import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, Order, RequestContext, Transaction } from '@vendure/core';

import { InstallmentPlan } from './installment-plan.entity';
import { InstallmentService } from './installment.service';

@Resolver()
export class InstallmentShopResolver {
    constructor(private installmentService: InstallmentService) {}

    @Query()
    installmentPlans(@Ctx() ctx: RequestContext, @Args('variantId') variantId: ID): Promise<InstallmentPlan[]> {
        return this.installmentService.findByVariant(ctx, variantId);
    }

    @Mutation()
    @Transaction()
    enableInstallment(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('planId') planId: ID,
    ): Promise<Order> {
        return this.installmentService.enableInstallment(ctx, orderId, planId);
    }
}
