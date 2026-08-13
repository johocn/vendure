import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    RequestContext,
    Transaction,
} from '@vendure/core';
import { ShippingProfileService } from './shipping-profile.service';
import { shippingProfilePermission } from './shipping-profile-permissions';

@Resolver()
export class ShippingProfileAdminResolver {
    constructor(private service: ShippingProfileService) {}

    @Query()
    @Allow(shippingProfilePermission.Permission)
    async shippingProfiles(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: any,
    ) {
        return this.service.findAll(ctx, options);
    }

    @Query()
    @Allow(shippingProfilePermission.Permission)
    async shippingProfile(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.service.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(shippingProfilePermission.Permission)
    async createShippingProfile(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.service.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(shippingProfilePermission.Permission)
    async updateShippingProfile(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.service.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(shippingProfilePermission.Permission)
    async deleteShippingProfile(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        await this.service.delete(ctx, id);
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(shippingProfilePermission.Permission)
    async assignShippingProfile(
        @Ctx() ctx: RequestContext,
        @Args('variantIds') variantIds: ID[],
        @Args('profileId') profileId: ID,
    ) {
        await this.service.assignToVariants(ctx, variantIds, profileId);
        return true;
    }
}