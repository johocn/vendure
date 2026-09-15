import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { ReconciliationService } from './reconciliation.service';

@Resolver()
export class ReconciliationAdminResolver {
    constructor(private reconciliationService: ReconciliationService) {}

    @Query()
    @Allow(Permission.SuperAdmin, Permission.ReadOrder)
    async reconciliationBatches(@Ctx() ctx: RequestContext) {
        return this.reconciliationService.listBatches(ctx);
    }

    @Query()
    @Allow(Permission.SuperAdmin, Permission.ReadOrder)
    async reconciliationLines(@Ctx() ctx: RequestContext, @Args('batchId') batchId: ID) {
        return this.reconciliationService.listLines(ctx, batchId);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin, Permission.UpdateOrder)
    async runReconciliation(
        @Ctx() ctx: RequestContext,
        @Args('date') date: string,
        @Args('trigger', { nullable: true }) trigger?: string,
    ) {
        return this.reconciliationService.runBatch(ctx, date, (trigger as any) ?? 'manual');
    }

    @Mutation()
    @Allow(Permission.SuperAdmin, Permission.UpdateOrder)
    async rerunReconciliationOrder(@Ctx() ctx: RequestContext, @Args('lineId') lineId: ID) {
        return this.reconciliationService.rerunOrder(ctx, lineId);
    }
}
