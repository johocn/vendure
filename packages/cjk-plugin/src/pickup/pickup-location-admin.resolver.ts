import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, EntityNotFoundError, ID, ListQueryOptions, PaginatedList, Permission, RequestContext, Transaction } from '@vendure/core';
import { PickupLocation } from './pickup-location.entity';
import { PickupLocationService } from './pickup-location.service';
import { PickupPermissions } from './pickup-permissions';
import { SetGlobalPickupLocation } from './pickup-location-permissions';

@Resolver()
export class PickupLocationAdminResolver {
    constructor(private pickupLocationService: PickupLocationService) {}

    @Query()
    @Allow(PickupPermissions.ReadPickupLocation as Permission)
    async pickupLocations(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListQueryOptions<PickupLocation>,
    ): Promise<PaginatedList<PickupLocation>> {
        return this.pickupLocationService.findAll(ctx, options);
    }

    @Query()
    @Allow(PickupPermissions.ReadPickupLocation as Permission)
    async pickupLocation(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<PickupLocation | undefined> {
        return this.pickupLocationService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.CreatePickupLocation as Permission)
    async createPickupLocation(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<PickupLocation> {
        return this.pickupLocationService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.UpdatePickupLocation as Permission)
    async updatePickupLocation(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<PickupLocation> {
        return this.pickupLocationService.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.DeletePickupLocation as Permission)
    async deletePickupLocation(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<boolean> {
        await this.pickupLocationService.delete(ctx, id);
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(SetGlobalPickupLocation.Permission, Permission.SuperAdmin)
    async promotePickupLocationToPublic(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<PickupLocation> {
        return this.pickupLocationService.promoteToPublic(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.AssignPickupLocation as Permission)
    async assignPickupLocationsToChannel(
        @Ctx() ctx: RequestContext,
        @Args('ids') ids: ID[],
    ): Promise<boolean> {
        await this.pickupLocationService.assignToChannel(ctx, ids, ctx.channelId);
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.AssignPickupLocation as Permission)
    async removePickupLocationsFromChannel(
        @Ctx() ctx: RequestContext,
        @Args('ids') ids: ID[],
    ): Promise<boolean> {
        await this.pickupLocationService.removeFromChannel(ctx, ids, ctx.channelId);
        return true;
    }
}
