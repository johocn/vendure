import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { DeliveryRange } from './delivery-range.entity';
import { DeliveryService } from './delivery.service';

@Resolver('DeliveryRange')
export class DeliveryAdminResolver {
    constructor(private deliveryService: DeliveryService) {}

    @Query()
    @Allow(Permission.UpdateSettings)
    async deliveryRange(@Ctx() ctx: RequestContext, @Args('shopId') shopId: ID): Promise<any> {
        return this.deliveryService.getRange(ctx, shopId);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async upsertDeliveryRange(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DeliveryRange> {
        return this.deliveryService.upsertRange(ctx, input);
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