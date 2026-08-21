import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { DeliveryRange } from './delivery-range.entity';
import { DeliveryService } from './delivery.service';

@Resolver('DeliveryRange')
export class DeliveryShopResolver {
    constructor(private deliveryService: DeliveryService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myDeliveryAddresses(@Ctx() ctx: RequestContext): Promise<any[]> {
        return this.deliveryService.listMyAddresses(ctx);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createDeliveryAddress(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.deliveryService.createAddress(ctx, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateDeliveryAddress(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ): Promise<any> {
        return this.deliveryService.updateAddress(ctx, id, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async deleteDeliveryAddress(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.deliveryService.deleteAddress(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async setDefaultDeliveryAddress(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<any[]> {
        return this.deliveryService.setDefaultAddress(ctx, id);
    }

    @Query()
    @Allow(Permission.Public)
    async shopDeliveryRange(@Ctx() ctx: RequestContext, @Args('shopId') shopId: ID): Promise<any> {
        return this.deliveryService.getRange(ctx, shopId);
    }

    @Query()
    @Allow(Permission.Public)
    async validateDelivery(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any[]> {
        return this.deliveryService.validateDelivery(ctx, input.address, input.shopIds);
    }

    @ResolveField('districtCodes')
    districtCodes(@Parent() range: DeliveryRange): string[] | null {
        const raw = (range as any).districtCodes;
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw) as string[];
        } catch {
            return null;
        }
    }
}