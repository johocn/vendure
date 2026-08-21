import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { Affiliate } from './affiliate.entity';
import { AffiliateWithdrawal } from './affiliate-withdrawal.entity';
import { AffiliateService } from './affiliate.service';

/**
 * 管理端分销接口。affiliates 返回本 channel 全量推广员；pay/reject 提现经 service.requireMyShop
 * 校验调用者为 active 店主（归属隔离由 Shop.administratorId 把关）。
 */
@Resolver()
export class AffiliateAdminResolver {
    constructor(private service: AffiliateService) {}

    /** 本 channel 全量推广员。 */
    @Query()
    @Allow(Permission.UpdateSettings)
    async affiliates(@Ctx() ctx: RequestContext): Promise<Affiliate[]> {
        return this.service.affiliates(ctx);
    }

    /** 店主支付提现（幂等）。schema 仅需 Authenticated 保底，真正授权由 service.requireMyShop 把关。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async payWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<AffiliateWithdrawal> {
        return this.service.payWithdrawalSafe(ctx, id);
    }

    /** 店主拒绝提现（幂等）。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async rejectWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<AffiliateWithdrawal> {
        return this.service.rejectWithdrawalSafe(ctx, id);
    }
}