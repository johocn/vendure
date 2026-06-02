import { RequestContext, ID, PaginatedList, ListQueryOptions } from '@vendure/core';
import { PickupLocation } from './pickup-location.entity';
import { PickupLocationService } from './pickup-location.service';
export declare class PickupLocationAdminResolver {
    private pickupLocationService;
    constructor(pickupLocationService: PickupLocationService);
    pickupLocations(ctx: RequestContext, options: ListQueryOptions<PickupLocation>): Promise<PaginatedList<PickupLocation>>;
    pickupLocation(ctx: RequestContext, id: ID): Promise<PickupLocation | undefined>;
    createPickupLocation(ctx: RequestContext, input: any): Promise<PickupLocation>;
    updatePickupLocation(ctx: RequestContext, input: any): Promise<PickupLocation>;
    deletePickupLocation(ctx: RequestContext, id: ID): Promise<boolean>;
}
