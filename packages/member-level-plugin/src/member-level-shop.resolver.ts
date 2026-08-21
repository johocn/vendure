import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { MemberLevelService } from './member-level.service';

@Resolver()
export class MemberLevelShopResolver {
    constructor(private memberLevelService: MemberLevelService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myMemberInfo(@Ctx() ctx: RequestContext): Promise<any> {
        return this.memberLevelService.getMyMemberInfo(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myTier(@Ctx() ctx: RequestContext): Promise<any> {
        return this.memberLevelService.getMyMemberInfo(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myPointsHistory(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.memberLevelService.getMyPointsHistory(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async redeemPoints(@Ctx() ctx: RequestContext, @Args('points') points: number): Promise<any> {
        return this.memberLevelService.redeemPoints(ctx, points);
    }
}
