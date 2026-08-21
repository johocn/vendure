import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';

import { memberLevelPermission } from './permissions';
import { MemberLevelService } from './member-level.service';

@Resolver()
export class MemberLevelAdminResolver {
    constructor(private memberLevelService: MemberLevelService) {}

    @Query()
    @Allow(memberLevelPermission.Read)
    async memberInfo(@Ctx() ctx: RequestContext, @Args('customerId') customerId: ID): Promise<any> {
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }

    @Query()
    @Allow(memberLevelPermission.Read)
    async pointsHistory(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.memberLevelService.getPointsHistory(ctx, customerId, options);
    }

    @Query()
    @Allow(memberLevelPermission.Read)
    async members(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.memberLevelService.findAllMembers(ctx, options);
    }

    @Query()
    @Allow(memberLevelPermission.Read)
    async levelConfig(@Ctx() ctx: RequestContext): Promise<any> {
        return this.memberLevelService.getLevelConfig(ctx);
    }

    @Mutation()
    @Allow(memberLevelPermission.Update)
    async adjustPoints(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('amount') amount: number,
        @Args('remark', { nullable: true }) remark?: string,
    ): Promise<any> {
        await this.memberLevelService.adjustPoints(ctx, customerId, amount, remark);
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }

    @Mutation()
    @Allow(memberLevelPermission.Update)
    async adjustMemberGrowth(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('amount') amount: number,
        @Args('source', { nullable: true }) source?: string,
    ): Promise<any> {
        await this.memberLevelService.addGrowthValue(ctx, customerId, amount, source);
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }

    @Mutation()
    @Allow(memberLevelPermission.Update)
    async updateLevelConfig(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<any> {
        return this.memberLevelService.updateLevelConfig(ctx, input);
    }

    @Query()
    @Allow(memberLevelPermission.Read)
    async memberTiers(@Ctx() ctx: RequestContext): Promise<any> {
        return this.memberLevelService.listMemberTiers(ctx);
    }

    @Mutation()
    @Allow(memberLevelPermission.Update)
    async saveTiers(
        @Ctx() ctx: RequestContext,
        @Args('input', { type: () => [Object] }) input: any[],
    ): Promise<any> {
        return this.memberLevelService.saveMemberTiers(ctx, input);
    }
}
