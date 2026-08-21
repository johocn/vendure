import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { Affiliate } from './affiliate.entity';
import { AffiliateRelation } from './affiliate-relation.entity';
import { AffiliateCommissionEntry } from './affiliate-commission.entity';
import { AffiliateWithdrawal } from './affiliate-withdrawal.entity';
import { AffiliateService } from './affiliate.service';

/**
 * C 端分销接口。身份均从 activeUserId 解析（推广员档案 / 顾客绑定），无需额外权限参数。
 */
@Resolver()
export class AffiliateShopResolver {
    constructor(private service: AffiliateService) {}

    /** 当前用户的推广员档案。 */
    @Query()
    @Allow(Permission.Authenticated)
    async myAffiliate(@Ctx() ctx: RequestContext): Promise<Affiliate | undefined> {
        return this.service.myAffiliate(ctx);
    }

    /** 当前用户的佣金明细（createdAt DESC）。 */
    @Query()
    @Allow(Permission.Authenticated)
    async myCommissionEntries(@Ctx() ctx: RequestContext): Promise<AffiliateCommissionEntry[]> {
        return this.service.myCommissionEntries(ctx);
    }

    /** 成为推广员（shopId 可空，空=全局推广）。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async becomeAffiliate(
        @Ctx() ctx: RequestContext,
        @Args('shopId', { nullable: true }) shopId?: ID,
    ): Promise<Affiliate> {
        return this.service.becomeAffiliate(ctx, shopId);
    }

    /** 顾客绑定推广关系。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async bindAffiliate(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('source', { nullable: true }) source?: string,
    ): Promise<AffiliateRelation> {
        return this.service.bindRelation(ctx, code, source as any);
    }

    /** 申请提现。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async requestWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('amount') amount: number,
    ): Promise<AffiliateWithdrawal> {
        return this.service.requestWithdrawal(ctx, amount);
    }
}