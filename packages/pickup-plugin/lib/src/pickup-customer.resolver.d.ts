import { ID, RequestContext } from '@vendure/core';
import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';
export declare class PickupCustomerResolver {
    private service;
    constructor(service: PickupService);
    myPickupCode(ctx: RequestContext, orderId: ID): Promise<PickupRedemption>;
    claimMyPickup(ctx: RequestContext, orderId: ID, code: string): Promise<PickupRedemption>;
}
