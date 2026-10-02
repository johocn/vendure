import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { WechatpayService, BarePaymentInput } from './wechatpay.service';

@Resolver()
export class WechatpayShopResolver {
    constructor(private wechatpayService: WechatpayService) {}

    @Mutation()
    @Allow(Permission.Authenticated)
    wechatpayCreatePayment(
        @Ctx() ctx: RequestContext,
        @Args('input') input: BarePaymentInput,
    ): Promise<unknown> {
        // 传 ctx：按当前请求渠道取该租户的商户凭证与回调地址
        return this.wechatpayService.createBarePayment(input, ctx);
    }
}