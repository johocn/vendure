import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Permission } from '@vendure/core';

import { WechatpayService, BarePaymentInput } from './wechatpay.service';

@Resolver()
export class WechatpayShopResolver {
    constructor(private wechatpayService: WechatpayService) {}

    @Mutation()
    @Allow(Permission.Authenticated)
    wechatpayCreatePayment(
        @Args('input') input: BarePaymentInput,
    ): Promise<unknown> {
        return this.wechatpayService.createBarePayment(input);
    }
}