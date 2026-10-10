// 酒店逐晚计价纯函数（与 nshop app/utils/hotel-pricing.ts 同规则；无副作用、坏数据返回 null）
import { dayTypeFor, HotelConfig, PriceSegmentType } from './hotel-config';
import { RatePlanAdjustment, applyNightlyAdjustment } from './booking/rate-plan-logic';

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
export function parseHotelRoomConfig(raw: unknown): HotelConfig | null {
    if (raw == null) return null;
    let obj: unknown = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    const cfg = obj as HotelConfig | null;
    if (!cfg || typeof cfg !== 'object') return null;
    if (typeof cfg.basePriceCent !== 'number' || cfg.basePriceCent < 0) return null;
    return cfg;
}

function toDateOnly(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * 晚数 = 离店 − 入住（入住当日计第 1 晚）；判定优先级 custom > holiday > weekend > weekday
 * ratePlan（P2 房价方案，可选）：per-night 套用后累计总价；fixed 类型连住优惠不再叠加（固定价直接生效），
 * discount/surcharge 仍按连住折扣率作用于总价。
 */
export function calcNightlyPricing(
    cfg: HotelConfig | null | undefined,
    checkIn: string,
    checkOut: string,
    ratePlan?: RatePlanAdjustment | null,
): NightlyPricingResult | null {
    if (!cfg || typeof cfg.basePriceCent !== 'number') return null;
    const inD = new Date(`${checkIn}T00:00:00`);
    const outD = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(inD.getTime()) || Number.isNaN(outD.getTime())) return null;
    const nights = Math.round((outD.getTime() - inD.getTime()) / 86400000);
    if (nights < 1) return null;

    const segments = Array.isArray(cfg.priceCalendar) ? cfg.priceCalendar : [];
    const rows: NightPriceRow[] = [];
    for (let i = 0; i < nights; i++) {
        const d = new Date(inD.getTime() + i * 86400000);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const type = dayTypeFor(date, segments);
        const seg = segments.find(s => s.type === type && s.dates?.includes(date))
            ?? segments.find(s => s.type === type);
        const price = seg
            ? (seg.priceCent != null ? seg.priceCent : Math.round(cfg.basePriceCent * (seg.rate ?? 1)))
            : cfg.basePriceCent;
        rows.push({ date, priceCent: price, type });
    }

    const discounts = (cfg.longStayDiscount ?? [])
        .filter(x => nights >= x.minNights)
        .sort((a, b) => b.minNights - a.minNights);
    const planAdjusted = ratePlan ? rows.map(r => ({ ...r, priceCent: applyNightlyAdjustment(r.priceCent, ratePlan) })) : rows;
    const baseTotal = planAdjusted.reduce((sum, r) => sum + r.priceCent, 0);
    const rate = ratePlan?.adjustType === 'fixed' ? 1 : discounts.length ? discounts[0].rate : 1;
    return { nights: planAdjusted, stayTotalCent: Math.round(baseTotal * rate) };
}

/** orderBoxes 行映射用：非酒店行返回全 null；酒店行回填日期/晚数，明细可因坏配置为 null */
export function buildHotelLineInfo(
    customFields: Record<string, any> | null | undefined,
    hotelRoomConfigRaw: unknown,
): HotelLineInfo {
    const cf = customFields ?? {};
    const checkIn = toDateOnly(cf.hotelCheckIn);
    const checkOut = toDateOnly(cf.hotelCheckOut);
    if (!checkIn || !checkOut) {
        return { isHotel: false, hotelCheckIn: null, hotelCheckOut: null, hotelNights: null, hotelNightly: null };
    }
    const nights = Math.round(
        (new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86400000,
    );
    const pricing = calcNightlyPricing(parseHotelRoomConfig(hotelRoomConfigRaw), checkIn, checkOut);
    return {
        isHotel: true,
        hotelCheckIn: checkIn,
        hotelCheckOut: checkOut,
        hotelNights: nights > 0 ? nights : null,
        hotelNightly: pricing?.nights ?? null,
    };
}