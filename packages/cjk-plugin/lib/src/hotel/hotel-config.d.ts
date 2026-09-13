export type PriceSegmentType = 'weekday' | 'weekend' | 'holiday' | 'custom';
export interface PriceSegment {
    type: PriceSegmentType;
    rate?: number;
    priceCent?: number;
    dates?: string[];
}
export interface LongStayDiscount {
    minNights: number;
    rate: number;
}
export interface CancelPolicy {
    type: 'freeUntil' | 'nonRefundable';
    freeUntilHours?: number;
}
export interface RoomDetail {
    no: string;
    floor: number;
    view?: string;
}
export interface HotelConfig {
    templateCode?: string;
    specs?: {
        bedType: string;
        bedDesc?: string;
        area: number;
        capacity: number;
        maxCapacity: number;
        addBed?: boolean;
        addBedFeeCent?: number;
        smoke?: string;
        window?: string;
        breakfast?: string;
        breakfastCount?: number;
        amenities?: Array<string | Record<string, string>>;
        tags?: Array<string | Record<string, string>>;
    };
    rooms?: RoomDetail[];
    basePriceCent: number;
    priceCalendar?: PriceSegment[];
    longStayDiscount?: LongStayDiscount[];
    minNights?: number;
    maxNights?: number;
    advanceDays?: number;
    checkInTime?: string;
    checkOutTime?: string;
    cancelPolicy?: CancelPolicy;
    depositType?: string;
}
export declare function dayTypeFor(dateStr: string, segments: PriceSegment[]): PriceSegmentType;
export declare function validateHotelConfig(cfg: Partial<HotelConfig>): {
    valid: boolean;
    errors: string[];
};
