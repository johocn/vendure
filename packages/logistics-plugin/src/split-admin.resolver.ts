import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { OrderSplitPlan, SplitLine } from './order-split-plan';

@Resolver()
export class SplitAdminResolver {
    constructor(
        private autoSplit: AutoSplitPlanService,
        private manualSplit: ManualSplitAdjustService,
    ) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async splitPlanPreview(@Ctx() ctx: RequestContext, @Args('orderId') orderId: string): Promise<OrderSplitPlan> {
        return this.autoSplit.buildAutoPlan(ctx, orderId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async confirmSplitPlan(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: string,
        @Args('packages') packages: Array<{ stockLocationId: string; lines: SplitLine[] }>,
    ): Promise<OrderSplitPlan> {
        return this.manualSplit.applyAdjustment(ctx, orderId, packages);
    }
}
