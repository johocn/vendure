import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { RechargeCardService } from './recharge-card.service';

@Resolver()
export class RechargeCardShopResolver {
    constructor(private rechargeCardService: RechargeCardService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myRechargeBalance(@Ctx() ctx: RequestContext): Promise<number> {
        return this.rechargeCardService.getBalance(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myRechargeHistory(@Ctx() ctx: RequestContext): Promise<any[]> {
        return this.rechargeCardService.findMyCards(ctx);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async redeemRechargeCard(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('pin', { nullable: true }) pin: string,
    ): Promise<any> {
        const card = await this.rechargeCardService.redeemCard(ctx, code, pin);
        const balance = await this.rechargeCardService.getBalance(ctx);
        return {
            success: true,
            faceValue: card.faceValue,
            newBalance: balance,
            cardCode: card.code,
        };
    }
}
