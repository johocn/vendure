import { HotelConfig, PriceSegmentType } from './hotel-config';
export interface NightPriceRow {
    date: string;
    priceCent: number;
    type: PriceSegmentType;
}
export interface NightlyPricingResult {
    nights: NightPriceRow[];
    stayTotalCent: number;
}
export interface HotelLineInfo {
    isHotel: boolean;
    hotelCheckIn: string | null;
    hotelCheckOut: string | null;
    hotelNights: number | null;
    hotelNightly: NightPriceRow[] | null;
}
/** hotelRoomConfig 存的是 JSON 字符串；坏 JSON / 缺 basePriceCent 一律 null（不抛异常） */
export declare function parseHotelRoomConfig(raw: unknown): HotelConfig | null;
/** 晚数 = 离店 − 入住（入住当日计第 1 晚）；判定优先级 custom > holiday > weekend > weekday */
export declare function calcNightlyPricing(cfg: HotelConfig | null | undefined, checkIn: string, checkOut: string): NightlyPricingResult | null;
/** orderBoxes 行映射用：非酒店行返回全 null；酒店行回填日期/晚数，明细可因坏配置为 null */
export declare function buildHotelLineInfo(customFields: Record<string, any> | null | undefined, hotelRoomConfigRaw: unknown): HotelLineInfo;
