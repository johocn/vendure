import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ListQueryOptions, PaginatedList, Permission, RequestContext } from '@vendure/core';

import { BalanceTransaction } from './balance-transaction.entity';
import { RechargeCardService } from './recharge-card.service';

@Resolver()
export class RechargeOrderResolver {
    constructor(private rechargeCardService: RechargeCardService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myRechargeOrders(@Ctx() ctx: RequestContext): Promise<any[]> {
        return this.rechargeCardService.findMyRechargeOrders(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myBalanceTransactions(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<BalanceTransaction>,
    ): Promise<PaginatedList<BalanceTransaction>> {
        return this.rechargeCardService.myBalanceTransactions(ctx, options);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createRechargeOrder(
        @Ctx() ctx: RequestContext,
        @Args('amount') amount: number,
        @Args('remark', { nullable: true }) remark: string,
    ): Promise<any> {
        return this.rechargeCardService.createRechargeOrder(ctx, amount, remark);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async payRechargeOrder(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.rechargeCardService.payRechargeOrder(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async cancelRechargeOrder(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        return this.rechargeCardService.cancelRechargeOrder(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createWechatRechargePayment(
        @Ctx() ctx: RequestContext,
        @Args('rechargeOrderId') rechargeOrderId: number,
        @Args('tradeType', { nullable: true }) tradeType?: string,
        @Args('openid', { nullable: true }) openid?: string,
    ): Promise<any> {
        return this.rechargeCardService.createWechatRechargePayment(ctx, rechargeOrderId, tradeType, openid);
    }
}