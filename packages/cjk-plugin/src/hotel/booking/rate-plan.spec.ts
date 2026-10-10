import { describe, expect, it } from 'vitest';

import { calcNightlyPricing, parseHotelRoomConfig } from '../hotel-nightly-pricing';
import { HotelConfig } from '../hotel-config';
import {
    RatePlanAdjustment,
    applyNightlyAdjustment,
    isRatePlanSaleable,
    isValidRatePlanAdjustment,
    parseMemberOnly,
} from './rate-plan-logic';

const CFG: HotelConfig = {
    basePriceCent: 32800,
    totalRooms: 5,
    longStayDiscount: [{ minNights: 3, rate: 0.9 }],
    priceCalendar: [
        { type: 'weekend', rate: 1.2 },
        { type: 'holiday', priceCent: 50000, dates: ['2026-10-01'] },
    ],
};

// 2026-10-01 是周四（holiday 50000）；10-02 周五（weekend 39360）；10-03~10-04 周末
const R_DISCOUNT: RatePlanAdjustment = { adjustType: 'discount', adjustValue: 900 };
const R_FIXED: RatePlanAdjustment = { adjustType: 'fixed', adjustValue: 30000 };
const R_SURCHARGE: RatePlanAdjustment = { adjustType: 'surcharge', adjustValue: 5000 };

describe('calcNightlyPricing × rate plan（三种 adjustType）', () => {
    it('基线回归：无方案时行为不变（rows 原始价、total 含连住折扣）', () => {
        const p = calcNightlyPricing(CFG, '2026-10-01', '2026-10-04')!; // 3 晚触发连住 0.9
        expect(p.nights.map(r => r.priceCent)).toEqual([50000, 39360, 39360]);
        expect(p.stayTotalCent).toBe(Math.round((50000 + 39360 + 39360) * 0.9));
    });

    it('discount：每晚 ×900/1000，连住优惠继续叠加总价', () => {
        const p = calcNightlyPricing(CFG, '2026-10-01', '2026-10-04', R_DISCOUNT)!;
        expect(p.nights.map(r => r.priceCent)).toEqual([45000, 35424, 35424]); // 50000×0.9 / 39360×0.9
        const subtotal = 45000 + 35424 + 35424;
        expect(p.stayTotalCent).toBe(Math.round(subtotal * 0.9));
    });
    it('discount：不足连住门槛时不叠加', () => {
        const p = calcNightlyPricing(CFG, '2026-10-01', '2026-10-03', R_DISCOUNT)!; // 2 晚
        expect(p.nights.map(r => r.priceCent)).toEqual([45000, 35424]);
        expect(p.stayTotalCent).toBe(45000 + 35424);
    });

    it('fixed：每晚固定价且连住优惠不再叠加', () => {
        const p = calcNightlyPricing(CFG, '2026-10-01', '2026-10-04', R_FIXED)!;
        expect(p.nights.map(r => r.priceCent)).toEqual([30000, 30000, 30000]);
        expect(p.stayTotalCent).toBe(90000); // 而非 90000 × 0.9
    });

    it('surcharge：每晚加价（节假日段也生效），连住优惠继续叠加', () => {
        const p = calcNightlyPricing(CFG, '2026-10-01', '2026-10-03', R_SURCHARGE)!;
        expect(p.nights.map(r => r.priceCent)).toEqual([55000, 44360]);
        expect(p.stayTotalCent).toBe(55000 + 44360);
    });

    it('坏方案形态（非法 adjustType/value）由调用方过滤——纯函数仍按值套用', () => {
        // 策略层已用 isValidRatePlanAdjustment 过滤，此用例锁定 applyNightlyAdjustment 不抛异常
        expect(applyNightlyAdjustment(32800, { adjustType: 'discount', adjustValue: 0 })).toBe(0);
    });
});

describe('applyNightlyAdjustment / isValidRatePlanAdjustment', () => {
    it('discount 千分比四舍五入', () => {
        expect(applyNightlyAdjustment(32800, R_DISCOUNT)).toBe(29520);
        expect(applyNightlyAdjustment(32805, R_DISCOUNT)).toBe(29525); // 32805*0.9=29524.5 → 29525
    });
    it('fixed / surcharge', () => {
        expect(applyNightlyAdjustment(32800, R_FIXED)).toBe(30000);
        expect(applyNightlyAdjustment(32800, R_SURCHARGE)).toBe(37800);
    });
    it('adjustType 白名单 + adjustValue 边界', () => {
        expect(isValidRatePlanAdjustment(R_DISCOUNT)).toBe(true);
        expect(isValidRatePlanAdjustment({ adjustType: 'discount', adjustValue: 1000 })).toBe(true);
        expect(isValidRatePlanAdjustment({ adjustType: 'discount', adjustValue: 0 })).toBe(false);
        expect(isValidRatePlanAdjustment({ adjustType: 'discount', adjustValue: 1001 })).toBe(false);
        expect(isValidRatePlanAdjustment({ adjustType: 'fixed', adjustValue: 0 })).toBe(false);
        expect(isValidRatePlanAdjustment({ adjustType: 'surcharge', adjustValue: 0 })).toBe(true);
        expect(isValidRatePlanAdjustment({ adjustType: 'raise' as any, adjustValue: 100 })).toBe(false);
        expect(isValidRatePlanAdjustment(null)).toBe(false);
        expect(isValidRatePlanAdjustment('x')).toBe(false);
    });
});

describe('isRatePlanSaleable（会员门槛 + 售卖期，与 C 端可见性同口径）', () => {
    const plan = (over: Partial<Parameters<typeof isRatePlanSaleable>[0]> = {}) => ({
        memberOnly: null as string | null,
        dateFrom: null as string | null,
        dateTo: null as string | null,
        ...over,
    });

    it('memberOnly=null 全员可见（含未登录）', () => {
        expect(isRatePlanSaleable(plan(), '2026-10-10', null)).toBe(true);
        expect(isRatePlanSaleable(plan(), '2026-10-10', 1)).toBe(true);
    });

    it('memberOnly 门槛：达到等级可见，未达标/未登录不可见', () => {
        const p = plan({ memberOnly: '3' });
        expect(isRatePlanSaleable(p, '2026-10-10', 3)).toBe(true);
        expect(isRatePlanSaleable(p, '2026-10-10', 9)).toBe(true);
        expect(isRatePlanSaleable(p, '2026-10-10', 2)).toBe(false);
        expect(isRatePlanSaleable(p, '2026-10-10', null)).toBe(false);
    });

    it('memberOnly 非数字 fail-closed', () => {
        expect(isRatePlanSaleable(plan({ memberOnly: 'vip-gold' }), '2026-10-10', 9)).toBe(false);
    });

    it('售卖期：入住日落在 [dateFrom, dateTo] 内可见，端点含', () => {
        const p = plan({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
        expect(isRatePlanSaleable(p, '2026-11-01', null)).toBe(true);
        expect(isRatePlanSaleable(p, '2026-11-30', null)).toBe(true);
        expect(isRatePlanSaleable(p, '2026-10-31', null)).toBe(false);
        expect(isRatePlanSaleable(p, '2026-12-01', null)).toBe(false);
    });

    it('半开售卖期：单端 null 不限', () => {
        expect(isRatePlanSaleable(plan({ dateFrom: '2026-11-01' }), '2027-01-01', null)).toBe(true);
        expect(isRatePlanSaleable(plan({ dateTo: '2026-11-30' }), '2026-01-01', null)).toBe(true);
    });

    it('入住日非法 → 不可售', () => {
        expect(isRatePlanSaleable(plan(), 'bad', null)).toBe(false);
    });

    it('checkIn 缺省：跳过售卖期判定，会员门槛仍强制（fail-closed）', () => {
        const p = plan({ memberOnly: '3', dateFrom: '2026-11-01' });
        expect(isRatePlanSaleable(plan(), null, null)).toBe(true);
        expect(isRatePlanSaleable(p, null, 3)).toBe(true);
        expect(isRatePlanSaleable(p, null, 1)).toBe(false);
        expect(isRatePlanSaleable(p, null, null)).toBe(false);
        expect(isRatePlanSaleable(plan({ dateFrom: '2026-11-01' }), null, null)).toBe(true);
    });
});

describe('parseMemberOnly', () => {
    it('null/空串 → null（全员）', () => {
        expect(parseMemberOnly(null)).toBeNull();
        expect(parseMemberOnly(undefined)).toBeNull();
        expect(parseMemberOnly('')).toBeNull();
        expect(parseMemberOnly('  ')).toBeNull();
    });
    it('数字字符串 → 数字；非法 → NaN', () => {
        expect(parseMemberOnly('2')).toBe(2);
        expect(parseMemberOnly(' 3 ')).toBe(3);
        expect(Number.isNaN(parseMemberOnly('vip') as number)).toBe(true);
    });
});

describe('parseHotelRoomConfig 回归（P2 语义不破坏 P1）', () => {
    it('坏 JSON / 缺 basePriceCent 返回 null', () => {
        expect(parseHotelRoomConfig('not-json')).toBeNull();
        expect(parseHotelRoomConfig(JSON.stringify({ totalRooms: 3 }))).toBeNull();
        expect(parseHotelRoomConfig(null)).toBeNull();
    });
    it('合法配置直通', () => {
        expect(parseHotelRoomConfig(JSON.stringify(CFG))?.basePriceCent).toBe(32800);
    });
});
