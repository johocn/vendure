import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Administrator,
    Allow,
    Ctx,
    ID,
    Permission,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { TenantMember } from '../tenant/tenant-member.entity';
import { PickBatchState } from './pick-batch.entity';
import { PickBatchService } from './pick-batch.service';

/** 配货台（拣货批次）admin 接口 */
@Resolver()
export class PickBatchAdminResolver {
    constructor(
        private pickBatchService: PickBatchService,
        private connection: TransactionalConnection,
    ) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async pickBatches(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.pickBatchService.findAllView(ctx, args.options ?? {});
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async pickBatch(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.pickBatchService.detail(ctx, id);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async pickBatchPickingList(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.pickBatchService.pickingList(ctx, id);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async pickBatchCandidates(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.pickBatchService.candidates(ctx, args.options ?? {});
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async createPickBatch(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        const createdBy = await this.currentOperator(ctx);
        const batch = await this.pickBatchService.create(
            ctx,
            {
                stockLocationId: Number(input.stockLocationId),
                orderIds: (input.orderIds ?? []).map(Number),
                note: input.note ?? null,
            },
            createdBy,
        );
        return this.pickBatchService.detail(ctx, batch.id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async addOrdersToPickBatch(
        @Ctx() ctx: RequestContext,
        @Args('batchId') batchId: ID,
        @Args('orderIds') orderIds: ID[],
    ) {
        await this.pickBatchService.addOrders(ctx, batchId, orderIds.map(Number));
        return this.pickBatchService.detail(ctx, batchId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async removeOrdersFromPickBatch(
        @Ctx() ctx: RequestContext,
        @Args('batchId') batchId: ID,
        @Args('orderIds') orderIds: ID[],
    ) {
        await this.pickBatchService.removeOrders(ctx, batchId, orderIds.map(Number));
        return this.pickBatchService.detail(ctx, batchId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async advancePickBatchState(
        @Ctx() ctx: RequestContext,
        @Args('batchId') batchId: ID,
        @Args('to') to: PickBatchState,
    ) {
        await this.pickBatchService.advance(ctx, batchId, to);
        return this.pickBatchService.detail(ctx, batchId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async cancelPickBatch(@Ctx() ctx: RequestContext, @Args('batchId') batchId: ID) {
        await this.pickBatchService.cancel(ctx, batchId);
        return this.pickBatchService.detail(ctx, batchId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async shipPickBatch(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.pickBatchService.ship(ctx, args.batchId, args.input ?? {});
    }

    /** 操作人：优先 TenantMember.displayName，回退 Administrator 名字 */
    private async currentOperator(ctx: RequestContext): Promise<string | null> {
        const userId = ctx.activeUserId;
        if (!userId) return null;
        const member = await this.connection.getRepository(ctx, TenantMember).findOne({
            where: { administratorId: String(userId) },
        });
        if (member?.displayName) return member.displayName;
        const admin = await this.connection.getRepository(ctx, Administrator).findOne({
            where: { id: userId },
        });
        if (!admin) return null;
        const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
        return name || null;
    }
}