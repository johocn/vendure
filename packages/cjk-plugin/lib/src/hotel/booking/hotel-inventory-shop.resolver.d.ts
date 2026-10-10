import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';
import { PriceSegmentType } from '../hotel-config';
export declare class HotelAvailabilityDay {
    date: string;
    priceCent: number;
    dayType: PriceSegmentType;
    /** null = 不限房 */
    remaining: number | null;
    closed: boolean;
}
export declare class HotelInventoryShopResolver {
    private inventory;
    private conn;
    constructor(inventory: HotelInventoryService, conn: TransactionalConnection);
    hotelAvailability(ctx: RequestContext, variantId: ID, from: string, to: string): Promise<HotelAvailabilityDay[]>;
}
