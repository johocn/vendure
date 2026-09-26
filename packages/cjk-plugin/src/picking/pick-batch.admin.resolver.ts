import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Permission,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { findAdministratorByUserId, resolveTenantMember } from '../tenant/resolve-tenant-member';
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

    /** 看板「拣货单数」KPI（D48）：服务端按窗口 COUNT，绕开 findAll 的 pageSize ≤ 100 硬上限 */
    @Query()
    @Allow(Permission.ReadOrder)
    async pickBatchShippedCount(
        @Ctx() ctx: RequestContext,
        @Args('from', { nullable: true }) from?: string,
        @Args('to', { nullable: true }) to?: string,
    ) {
        return this.pickBatchService.countShipped(ctx, { from, to });
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

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async handoverPickBatch(
        @Ctx() ctx: RequestContext,
        @Args('batchId') batchId: ID,
        @Args('handoverTo') handoverTo: string,
    ) {
        await this.pickBatchService.handover(ctx, batchId, handoverTo);
        return this.pickBatchService.detail(ctx, batchId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async registerPickBatchException(
        @Ctx() ctx: RequestContext,
        @Args('batchId') batchId: ID,
        @Args('reason') reason: string,
    ) {
        await this.pickBatchService.registerException(ctx, batchId, reason);
        return this.pickBatchService.detail(ctx, batchId);
    }

    /** 操作人：优先 TenantMember.displayName，回退 Administrator 名字
     *  （D47 修正键错位：ctx.activeUserId 是 User.id，而 TenantMember.administratorId 存的是 Administrator.id，
     *    旧写法两步都用 User.id 去匹配 → 恒返回 null，"创建人" 永远为空。换键统一走共享 helper。） */
    private async currentOperator(ctx: RequestContext): Promise<string | null> {
        const userId = ctx.activeUserId;
        if (!userId) return null;
        const member = await resolveTenantMember(ctx, this.connection, userId, ctx.channelId);
        if (member?.displayName) return member.displayName;
        const admin = await findAdministratorByUserId(ctx, this.connection, userId);
        if (!admin) return null;
        const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
        return name || null;
    }
}