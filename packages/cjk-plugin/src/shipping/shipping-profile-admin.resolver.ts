import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Logger,
    RequestContext,
    Transaction,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import { DeliveryFacetService } from './delivery-facet.service';
import { ShippingProfileService } from './shipping-profile.service';
import { shippingProfilePermission } from './shipping-profile-permissions';

@Resolver()
export class ShippingProfileAdminResolver {
    constructor(
        private service: ShippingProfileService,
        private deliveryFacetService: DeliveryFacetService,
    ) {}

    /**
     * facet 只是配送能力的「派生索引」，同步失败不应让档案写操作报错/回滚
     * （否则商户改一次档案就整单失败）。失败只记日志，索引由下次档案变更重建。
     */
    private async syncFacetSilently(action: () => Promise<unknown>): Promise<void> {
        try {
            await action();
        } catch (e: any) {
            Logger.warn(`配送 facet 同步失败（不影响本次写入）：${e?.message ?? e}`, loggerCtx);
        }
    }

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
        const profile = await this.service.create(ctx, input);
        await this.syncFacetSilently(() => this.deliveryFacetService.rebuildChannel(ctx));
        return profile;
    }

    @Mutation()
    @Transaction()
    @Allow(shippingProfilePermission.Permission)
    async updateShippingProfile(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        const profile = await this.service.update(ctx, input);
        await this.syncFacetSilently(() => this.deliveryFacetService.rebuildChannel(ctx));
        return profile;
    }

    @Mutation()
    @Transaction()
    @Allow(shippingProfilePermission.Permission)
    async deleteShippingProfile(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        await this.service.delete(ctx, id);
        await this.syncFacetSilently(() => this.deliveryFacetService.rebuildChannel(ctx));
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
        await this.syncFacetSilently(() => this.deliveryFacetService.syncVariants(ctx, variantIds));
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(shippingProfilePermission.Permission)
    async setTenantDefaultShippingProfile(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        await this.service.setTenantDefault(ctx, id);
        await this.syncFacetSilently(() => this.deliveryFacetService.rebuildChannel(ctx));
        return true;
    }
}