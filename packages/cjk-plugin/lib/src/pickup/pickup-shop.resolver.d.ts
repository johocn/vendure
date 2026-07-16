import { ID, Order, RequestContext } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { PickupLocationService } from './pickup-location.service';
export declare class PickupShopResolver {
    private orderService;
    private pickupLocationService;
    constructor(orderService: OrderService, pickupLocationService: PickupLocationService);
    setOrderPickupLocation(ctx: RequestContext, pickupLocationId: ID, pickupType: string): Promise<Order>;
}
