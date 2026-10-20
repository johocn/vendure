import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { CouponSettlementReconcileService } from './coupon-settlement-reconcile.service';
import { CouponSettlementService } from './coupon-settlement.service';

/**
 * 券结算单后台（admin-api，T1 结算流水 + T5 对账）：查询 + 手动触发（运维）。
 * 权限对齐券商城后台（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
@Resolver()
export class CouponSettlementAdminResolver {
    constructor(
        private settlementService: CouponSettlementService,
        private reconcileService: CouponSettlementReconcileService,
    ) {}

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponSettlementOrders(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options?: any) {
        return this.settlementService.listSettlements(ctx, {
            skip: options?.skip ?? 0,
            take: options?.take ?? 20,
            status: options?.status ?? undefined,
        });
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponSettlementOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.settlementService.findSettlement(ctx, Number(id));
    }

    /** 手动触发 T+1 汇总周期（补登 → 提交分账 → 回执推进），运维排查用 */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async runCouponSettlementCycle(@Ctx() ctx: RequestContext) {
        return this.settlementService.manualRunCycle(ctx);
    }

    // ---- T5 结算对账 ----

    /** 台账页差异查询（默认只看未解决差异） */
    @Query()
    @Allow(Permission.UpdateOrder)
    async couponReconcileDiffs(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options?: any) {
        return this.reconcileService.listDiffs(ctx, {
            skip: options?.skip ?? 0,
            take: options?.take ?? 20,
            severity: options?.severity ?? undefined,
            diffType: options?.diffType ?? undefined,
            includeResolved: options?.includeResolved ?? false,
        });
    }

    /** 手动跑一轮对账（结算单 ↔ 分账回单 ↔ 商户核销流水） */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async runCouponReconcile(@Ctx() ctx: RequestContext) {
        return this.reconcileService.runReconcile(ctx);
    }

    /** 标记差异已处理（保留审计） */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async resolveCouponReconcileDiff(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('remark', { nullable: true }) remark?: string) {
        return this.reconcileService.resolveDiff(ctx, Number(id), remark);
    }
}
