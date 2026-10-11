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
    /**
     * 免费窗口外取消的扣款口径（P4 Task 14，仅 type=freeUntil 生效；缺省 firstNight）：
     * firstNight = 扣首晚房费退余款；full = 扣全款不退。
     * nonRefundable 恒为扣全款，无需此字段。
     */
    partial?: 'firstNight' | 'full';
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
    /** 当日总房量（缺省房量）：无 HotelRoomDay 行时回退此值；缺失 → 不限房 */
    totalRooms?: number;
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
