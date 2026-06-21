import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { RechargeCardService } from './recharge-card.service';

@Resolver()
export class RechargeCardAdminResolver {
    constructor(private rechargeCardService: RechargeCardService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async rechargeCards(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.rechargeCardService.findAll(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadSettings)
    async rechargeCardBatches(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.rechargeCardService.findAllBatches(ctx, options);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async createRechargeCardBatch(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<any> {
        return this.rechargeCardService.createBatch(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async freezeRechargeCard(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.rechargeCardService.freezeCard(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async unfreezeRechargeCard(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.rechargeCardService.unfreezeCard(ctx, id);
    }
}
