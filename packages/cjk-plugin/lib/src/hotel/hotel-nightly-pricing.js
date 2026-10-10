"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHotelRoomConfig = parseHotelRoomConfig;
exports.calcNightlyPricing = calcNightlyPricing;
exports.buildHotelLineInfo = buildHotelLineInfo;
// 酒店逐晚计价纯函数（与 nshop app/utils/hotel-pricing.ts 同规则；无副作用、坏数据返回 null）
const hotel_config_1 = require("./hotel-config");
const rate_plan_logic_1 = require("./booking/rate-plan-logic");
/** hotelRoomConfig 存的是 JSON 字符串；坏 JSON / 缺 basePriceCent 一律 null（不抛异常） */
function parseHotelRoomConfig(raw) {
    if (raw == null)
        return null;
    let obj = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        }
        catch (_a) {
            return null;
        }
    }
    const cfg = obj;
    if (!cfg || typeof cfg !== 'object')
        return null;
    if (typeof cfg.basePriceCent !== 'number' || cfg.basePriceCent < 0)
        return null;
    return cfg;
}
function toDateOnly(v) {
    if (typeof v !== 'string')
        return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
/**
 * 晚数 = 离店 − 入住（入住当日计第 1 晚）；判定优先级 custom > holiday > weekend > weekday
 * ratePlan（P2 房价方案，可选）：per-night 套用后累计总价；fixed 类型连住优惠不再叠加（固定价直接生效），
 * discount/surcharge 仍按连住折扣率作用于总价。
 */
function calcNightlyPricing(cfg, checkIn, checkOut, ratePlan) {
    var _a, _b, _c;
    if (!cfg || typeof cfg.basePriceCent !== 'number')
        return null;
    const inD = new Date(`${checkIn}T00:00:00`);
    const outD = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(inD.getTime()) || Number.isNaN(outD.getTime()))
        return null;
    const nights = Math.round((outD.getTime() - inD.getTime()) / 86400000);
    if (nights < 1)
        return null;
    const segments = Array.isArray(cfg.priceCalendar) ? cfg.priceCalendar : [];
    const rows = [];
    for (let i = 0; i < nights; i++) {
        const d = new Date(inD.getTime() + i * 86400000);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const type = (0, hotel_config_1.dayTypeFor)(date, segments);
        const seg = (_a = segments.find(s => { var _a; return s.type === type && ((_a = s.dates) === null || _a === void 0 ? void 0 : _a.includes(date)); })) !== null && _a !== void 0 ? _a : segments.find(s => s.type === type);
        const price = seg
            ? (seg.priceCent != null ? seg.priceCent : Math.round(cfg.basePriceCent * ((_b = seg.rate) !== null && _b !== void 0 ? _b : 1)))
            : cfg.basePriceCent;
        rows.push({ date, priceCent: price, type });
    }
    const discounts = ((_c = cfg.longStayDiscount) !== null && _c !== void 0 ? _c : [])
        .filter(x => nights >= x.minNights)
        .sort((a, b) => b.minNights - a.minNights);
    const planAdjusted = ratePlan ? rows.map(r => (Object.assign(Object.assign({}, r), { priceCent: (0, rate_plan_logic_1.applyNightlyAdjustment)(r.priceCent, ratePlan) }))) : rows;
    const baseTotal = planAdjusted.reduce((sum, r) => sum + r.priceCent, 0);
    const rate = (ratePlan === null || ratePlan === void 0 ? void 0 : ratePlan.adjustType) === 'fixed' ? 1 : discounts.length ? discounts[0].rate : 1;
    return { nights: planAdjusted, stayTotalCent: Math.round(baseTotal * rate) };
}
/** orderBoxes 行映射用：非酒店行返回全 null；酒店行回填日期/晚数，明细可因坏配置为 null */
function buildHotelLineInfo(customFields, hotelRoomConfigRaw) {
    var _a;
    const cf = customFields !== null && customFields !== void 0 ? customFields : {};
    const checkIn = toDateOnly(cf.hotelCheckIn);
    const checkOut = toDateOnly(cf.hotelCheckOut);
    if (!checkIn || !checkOut) {
        return { isHotel: false, hotelCheckIn: null, hotelCheckOut: null, hotelNights: null, hotelNightly: null };
    }
    const nights = Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86400000);
    const pricing = calcNightlyPricing(parseHotelRoomConfig(hotelRoomConfigRaw), checkIn, checkOut);
    return {
        isHotel: true,
        hotelCheckIn: checkIn,
        hotelCheckOut: checkOut,
        hotelNights: nights > 0 ? nights : null,
        hotelNightly: (_a = pricing === null || pricing === void 0 ? void 0 : pricing.nights) !== null && _a !== void 0 ? _a : null,
    };
}
//# sourceMappingURL=hotel-nightly-pricing.js.map