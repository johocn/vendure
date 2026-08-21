import { RequestContext } from '@vendure/core';
import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';
export declare class PickupOwnerResolver {
    private service;
    constructor(service: PickupService);
    myPickupOrders(ctx: RequestContext, args: any): Promise<{
        items: PickupRedemption[];
        totalItems: number;
    }>;
    claimPickupByShop(ctx: RequestContext, code: string): Promise<PickupRedemption>;
}
