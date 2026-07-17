import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { PickupLocationService } from './pickup-location.service';
import { EmployeeCustomerService } from './enterprise-customer/enterprise-customer.service';
import { PickupLocation } from './pickup-location.entity';

@Resolver()
export class PickupLocationShopResolver {
    constructor(
        private pickupLocationService: PickupLocationService,
        private employeeCustomerService: EmployeeCustomerService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async pickupLocations(
        @Ctx() ctx: RequestContext,
        @Args('type') type?: string,
        @Args('lat') lat?: number,
        @Args('lng') lng?: number,
    ): Promise<PickupLocation[]> {
        const locations = type
            ? await this.pickupLocationService.findByType(ctx, type)
            : (await this.pickupLocationService.findAll(ctx)).items;
        if (lat != null && lng != null) {
            return this.pickupLocationService.sortByDistance(locations, lat, lng);
        }
        return locations;
    }

    @Query()
    @Allow(Permission.Owner)
    async employeePickupLocations(
        @Ctx() ctx: RequestContext,
        @Args('lat') lat?: number,
        @Args('lng') lng?: number,
    ): Promise<PickupLocation[]> {
        const mode = (ctx.channel as any).customFields.employeePickupMode;
        if (mode === 'disabled') return [];

        if (mode === 'loose') {
            const locations = await this.pickupLocationService.findByType(ctx, 'employee');
            if (lat != null && lng != null) {
                return this.pickupLocationService.sortByDistance(locations, lat, lng);
            }
            return locations;
        }

        // strict
        if (!ctx.activeUserId) return [];
        const bindings = await this.employeeCustomerService.findByCustomer(ctx, ctx.activeUserId as any);
        const locationIds = bindings.flatMap(b => b.pickupLocations.map(l => l.id));
        const locations = await this.pickupLocationService.findByIds(ctx, locationIds);
        if (lat != null && lng != null) {
            return this.pickupLocationService.sortByDistance(locations, lat, lng);
        }
        return locations;
    }
}
