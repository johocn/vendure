import { OrderService, RequestContext } from '@vendure/core';
import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';
export declare class PickupAdminResolver {
    private service;
    private orderService;
    constructor(service: PickupService, orderService: OrderService);
    pickupRedemptions(ctx: RequestContext, args: any): Promise<{
        items: PickupRedemption[];
        totalItems: number;
    }>;
    /** orderCode 无实体内置列，运行时从 Order 反查补全。 */
    orderCode(ctx: RequestContext, redemption: PickupRedemption): Promise<string | null>;
}
