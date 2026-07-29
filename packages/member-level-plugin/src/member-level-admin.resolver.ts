import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { DeliveryPermissions } from '@vendure/delivery-plugin';

import { MemberLevelService } from './member-level.service';

@Resolver()
export class MemberLevelAdminResolver {
    constructor(private memberLevelService: MemberLevelService) {}

    @Query()
    @Allow(DeliveryPermissions.ManageMember as any)
    async memberInfo(@Ctx() ctx: RequestContext, @Args('customerId') customerId: ID): Promise<any> {
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }

    @Query()
    @Allow(DeliveryPermissions.ManageMember as any)
    async pointsHistory(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.memberLevelService.getPointsHistory(ctx, customerId, options);
    }

    @Query()
    @Allow(DeliveryPermissions.ManageMember as any)
    async members(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.memberLevelService.findAllMembers(ctx, options);
    }

    @Query()
    @Allow(DeliveryPermissions.ManageMember as any)
    async levelConfig(@Ctx() ctx: RequestContext): Promise<any> {
        return this.memberLevelService.getLevelConfig(ctx);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMember as any)
    async adjustPoints(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('amount') amount: number,
        @Args('remark', { nullable: true }) remark?: string,
    ): Promise<any> {
        return this.memberLevelService.adjustPoints(ctx, customerId, amount, remark);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMember as any)
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
    @Allow(DeliveryPermissions.ManageMember as any)
    async updateLevelConfig(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<any> {
        return this.memberLevelService.updateLevelConfig(ctx, input);
    }
}
