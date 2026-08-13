import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { PaymentProfileService } from './payment-profile.service';

@Resolver()
export class PaymentProfileShopResolver {
    constructor(private service: PaymentProfileService) {}

    @Query()
    async eligiblePaymentMethodsByProfile(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        const intersected = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        if (intersected.length === 0) return [];
        return this.service.findPaymentMethodsByIds(ctx, intersected.map(m => m.id));
    }

    @Query()
    async eligibleInstallmentOptions(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        return this.service.getIntersectedInstallmentOptions(ctx, profileIds);
    }

    @Query()
    async checkPaymentProfileCompatibility(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        const methods = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        return {
            compatible: methods.length > 0,
            intersectedCount: methods.length,
        };
    }
}