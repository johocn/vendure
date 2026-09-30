import { describe, expect, it } from 'vitest';
import {
    buildHotelLineInfo,
    calcNightlyPricing,
    parseHotelRoomConfig,
} from './hotel-nightly-pricing';

const cfg = {
    basePriceCent: 88000,
    priceCalendar: [{ type: 'holiday' as const, priceCent: 100000, dates: ['2026-02-14'] }],
    minNights: 1,
    maxNights: 30,
};

describe('parseHotelRoomConfig', () => {
    it('合法 JSON 字符串解析为对象', () => {
        expect(parseHotelRoomConfig(JSON.stringify(cfg))?.basePriceCent).toBe(88000);
    });
    it('坏 JSON / 非字符串 / 缺 basePriceCent 一律 null', () => {
        expect(parseHotelRoomConfig('{oops')).toBeNull();
        expect(parseHotelRoomConfig(null)).toBeNull();
        expect(parseHotelRoomConfig(JSON.stringify({ priceCalendar: [] }))).toBeNull();
    });
});

describe('calcNightlyPricing', () => {
    it('节假日 1000 + 周末 880，2 晚合计 1880', () => {
        const r = calcNightlyPricing(cfg, '2026-02-14', '2026-02-16');
        expect(r?.nights.map(n => [n.date, n.priceCent, n.type])).toEqual([
            ['2026-02-14', 100000, 'holiday'],
            ['2026-02-15', 88000, 'weekend'],
        ]);
        expect(r?.stayTotalCent).toBe(188000);
    });
    it('连住折扣取满足 minNights 且门槛最高的一条', () => {
        const r = calcNightlyPricing(
            { ...cfg, longStayDiscount: [{ minNights: 2, rate: 0.9 }, { minNights: 5, rate: 0.8 }] },
            '2026-02-14', '2026-02-16',
        );
        expect(r?.stayTotalCent).toBe(169200); // 188000 * 0.9
    });
    it('离店早于/等于入住、缺日期一律 null', () => {
        expect(calcNightlyPricing(cfg, '2026-02-16', '2026-02-16')).toBeNull();
        expect(calcNightlyPricing(cfg, '', '2026-02-16')).toBeNull();
    });
    it('cfg 为 null 时 null', () => {
        expect(calcNightlyPricing(null, '2026-02-14', '2026-02-16')).toBeNull();
    });
});

describe('buildHotelLineInfo', () => {
    it('非酒店行：isHotel=false 且其余字段为 null', () => {
        expect(buildHotelLineInfo({}, undefined)).toEqual({
            isHotel: false, hotelCheckIn: null, hotelCheckOut: null,
            hotelNights: null, hotelNightly: null,
        });
    });
    it('酒店行：回填日期/晚数/逐晚明细', () => {
        const info = buildHotelLineInfo(
            { hotelCheckIn: '2026-02-14', hotelCheckOut: '2026-02-16', hotelNights: 2 },
            JSON.stringify(cfg),
        );
        expect(info.isHotel).toBe(true);
        expect(info.hotelNights).toBe(2);
        expect(info.hotelNightly?.length).toBe(2);
    });
    it('有日期但配置坏 JSON：仍标 isHotel（前端要隐藏步进器），明细为 null', () => {
        const info = buildHotelLineInfo({ hotelCheckIn: '2026-02-14', hotelCheckOut: '2026-02-16' }, '{oops');
        expect(info.isHotel).toBe(true);
        expect(info.hotelNights).toBe(2);
        expect(info.hotelNightly).toBeNull();
    });
});