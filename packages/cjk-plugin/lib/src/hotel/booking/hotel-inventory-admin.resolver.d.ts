import { ID, RequestContext } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';
import { HotelRoomDay } from './room-day.entity';
import { HotelAvailabilityDay } from './hotel-inventory-shop.resolver';
export declare class HotelInventoryAdminResolver {
    private inventory;
    constructor(inventory: HotelInventoryService);
    hotelRoomDays(ctx: RequestContext, variantId: ID, month: string): Promise<HotelRoomDay[]>;
    /** 与 shop 端同构（含两端窗口）；web-admin 房量日历「剩 N」用 */
    hotelAvailability(ctx: RequestContext, variantId: ID, from: string, to: string): Promise<HotelAvailabilityDay[]>;
    setHotelRoomDay(ctx: RequestContext, variantId: ID, date: string, totalRooms?: number, closed?: boolean): Promise<HotelRoomDay>;
    batchSetHotelRoomDays(ctx: RequestContext, variantId: ID, from: string, to: string, totalRooms?: number, closed?: boolean, weekdays?: number[]): Promise<number>;
}
