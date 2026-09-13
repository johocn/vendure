import { DeepPartial, VendureEntity } from '@vendure/core';
import { CancelPolicy, HotelConfig, LongStayDiscount, PriceSegment, RoomDetail } from './hotel-config';
/**
 * 房型模板（快照源）：客户在商品变体上应用模板时，
 * 整体深拷贝进变体 customFields hotelRoomConfig，模板后续修改不影响已用商品。
 */
export declare class RoomTemplate extends VendureEntity {
    constructor(input?: DeepPartial<RoomTemplate>);
    code: string;
    name: string;
    enabled: boolean;
    sortOrder: number;
    coverAssetId: string | null;
    specs: HotelConfig['specs'] | null;
    defaultRooms: RoomDetail[] | null;
    basePriceCent: number;
    priceCalendar: PriceSegment[] | null;
    longStayDiscount: LongStayDiscount[] | null;
    minNights: number;
    maxNights: number;
    advanceDays: number;
    checkInTime: string;
    checkOutTime: string;
    cancelPolicy: CancelPolicy;
    depositType: string;
}
