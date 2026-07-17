import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { MemberLevelService } from './member-level.service';

@Resolver()
export class MemberLevelAdminResolver {
    constructor(private memberLevelService: MemberLevelService) {}

    @Query()
    @Allow(Permission.ReadCustomer)
    async memberInfo(@Ctx() ctx: RequestContext, @Args('customerId') customerId: ID): Promise<any> {
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }

    @Query()
    @Allow(Permission.ReadCustomer)
    async pointsHistory(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.memberLevelService.getPointsHistory(ctx, customerId, options);
    }

    @Mutation()
    @Allow(Permission.UpdateCustomer)
    async adjustPoints(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('amount') amount: number,
        @Args('remark', { nullable: true }) remark?: string,
    ): Promise<any> {
        return this.memberLevelService.adjustPoints(ctx, customerId, amount, remark);
    }
}
