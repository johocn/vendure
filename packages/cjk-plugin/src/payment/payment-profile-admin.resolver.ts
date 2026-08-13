import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    RequestContext,
    Transaction,
} from '@vendure/core';
import { PaymentProfileService } from './payment-profile.service';
import { paymentProfilePermission } from './payment-profile-permissions';

@Resolver()
export class PaymentProfileAdminResolver {
    constructor(private service: PaymentProfileService) {}

    @Query()
    @Allow(paymentProfilePermission.Permission)
    async paymentProfiles(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: any,
    ) {
        return this.service.findAll(ctx, options);
    }

    @Query()
    @Allow(paymentProfilePermission.Permission)
    async paymentProfile(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.service.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(paymentProfilePermission.Permission)
    async createPaymentProfile(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.service.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(paymentProfilePermission.Permission)
    async updatePaymentProfile(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.service.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(paymentProfilePermission.Permission)
    async deletePaymentProfile(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        await this.service.delete(ctx, id);
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(paymentProfilePermission.Permission)
    async assignPaymentProfile(
        @Ctx() ctx: RequestContext,
        @Args('variantIds') variantIds: ID[],
        @Args('profileId') profileId: ID,
    ) {
        await this.service.assignToVariants(ctx, variantIds, profileId);
        return true;
    }
}