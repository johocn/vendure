import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { BillPayService } from './bill-pay.service';
import { BillPayStatus } from './types';

/**
 * 代买单（shop-api）：客户提交委托、取消、支付（微信/余额）、我的委托单。
 * 归属校验（本人/本渠道）在 BillPayService 内完成；自动报价在创建时同步返回。
 */
@Resolver()
export class BillPayShopResolver {
    constructor(private billPayService: BillPayService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async billPayOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.billPayService.toGraph(await this.billPayService.findOwnedBillPayOrder(ctx, id));
    }

    @Query()
    @Allow(Permission.Authenticated)
    async billPayOrders(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: { skip?: number; take?: number; status?: BillPayStatus },
    ) {
        const statuses = options?.status ? [options.status] : undefined;
        const items = await this.billPayService.myBillPayOrders(ctx, statuses);
        const take = Math.min(100, Math.max(1, options?.take ?? 20));
        return { items: items.slice(0, take).map(o => this.billPayService.toGraph(o)), totalItems: items.length };
    }

    @Query()
    async billPayConfig(@Ctx() ctx: RequestContext) {
        return this.billPayService.getChannelConfig(ctx);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async createBillPayOrder(
        @Ctx() ctx: RequestContext,
        @Args('input')
        input: {
            merchantName: string;
            merchantId?: string | number | null;
            expectedAmount: number;
            remark?: string;
            couponCode?: string | null;
        },
    ) {
        return this.billPayService.toGraph(await this.billPayService.createBillPayOrder(ctx, input));
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async cancelBillPayOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.billPayService.toGraph(await this.billPayService.cancelBillPayOrder(ctx, id));
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createWechatBillPayment(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('tradeType', { nullable: true }) tradeType?: string,
        @Args('openid', { nullable: true }) openid?: string,
    ) {
        const tt = (tradeType ?? 'JSAPI') as 'JSAPI' | 'NATIVE' | 'H5' | 'APP';
        return this.billPayService.createWechatBillPayment(ctx, id, tt, openid);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async payBillPayOrderWithBalance(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.billPayService.toGraph(await this.billPayService.payBillPayOrderWithBalance(ctx, id));
    }
}
