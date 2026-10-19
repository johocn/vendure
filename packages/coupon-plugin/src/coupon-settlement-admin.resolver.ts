import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { CouponSettlementService } from './coupon-settlement.service';

/**
 * 券结算单后台（admin-api，T1）：结算流水查询 + 手动触发汇总周期（运维）。
 * 权限对齐券商城后台（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
@Resolver()
export class CouponSettlementAdminResolver {
    constructor(private settlementService: CouponSettlementService) {}

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
}
