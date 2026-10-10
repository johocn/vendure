import { ID, RequestContext } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';
export declare class HotelAvailabilityDay {
    date: string;
    priceCent: number;
    dayType: string;
    /** null = 不限房 */
    remaining: number | null;
    closed: boolean;
}
export declare class HotelInventoryShopResolver {
    private inventory;
    constructor(inventory: HotelInventoryService);
    hotelAvailability(ctx: RequestContext, variantId: ID, from: string, to: string): Promise<HotelAvailabilityDay[]>;
}
