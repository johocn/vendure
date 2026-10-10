import { ID, RequestContext } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';
import { HotelRoomDay } from './room-day.entity';
export declare class HotelInventoryAdminResolver {
    private inventory;
    constructor(inventory: HotelInventoryService);
    hotelRoomDays(ctx: RequestContext, variantId: ID, month: string): Promise<HotelRoomDay[]>;
    setHotelRoomDay(ctx: RequestContext, variantId: ID, date: string, totalRooms?: number, closed?: boolean): Promise<HotelRoomDay>;
    batchSetHotelRoomDays(ctx: RequestContext, variantId: ID, from: string, to: string, totalRooms?: number, closed?: boolean, weekdays?: number[]): Promise<number>;
}
