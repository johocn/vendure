import { describe, expect, it } from 'vitest';
import { validateHotelConfig, dayTypeFor } from './hotel-config';

describe('validateHotelConfig', () => {
  it('合法配置通过', () => {
    const r = validateHotelConfig({
      basePriceCent: 88800,
      priceCalendar: [
        { type: 'weekday', rate: 1.0 },
        { type: 'holiday', rate: 1.8, dates: ['2026-10-01'] },
      ],
    });
    expect(r.valid).toBe(true);
  });
  it('holiday 段缺 dates 报错', () => {
    const r = validateHotelConfig({
      basePriceCent: 88800,
      priceCalendar: [{ type: 'holiday', rate: 1.8 }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain('dates');
  });
  it('rate 与 priceCent 同时存在报错', () => {
    const r = validateHotelConfig({
      basePriceCent: 88800,
      priceCalendar: [{ type: 'weekend', rate: 1.2, priceCent: 99900 }],
    });
    expect(r.valid).toBe(false);
  });
  it('capacity 非法报错', () => {
    const r = validateHotelConfig({
      basePriceCent: 88800,
      specs: { capacity: 0, maxCapacity: 1 },
    });
    expect(r.valid).toBe(false);
  });
});

describe('dayTypeFor', () => {
  it('周一到周四 weekday', () => {
    expect(dayTypeFor('2026-09-14', [])).toBe('weekday'); // 周一
  });
  it('周五周六周日 weekend', () => {
    expect(dayTypeFor('2026-09-18', [])).toBe('weekend'); // 周五
  });
  it('custom 日期段优先', () => {
    expect(
      dayTypeFor('2026-10-01', [{ type: 'custom', rate: 1.5, dates: ['2026-10-01'] }]),
    ).toBe('custom');
  });
  it('holiday 优先于 weekend', () => {
    // 2026-10-02 周五：既是 weekend 又在 holiday dates
    expect(
      dayTypeFor('2026-10-02', [{ type: 'weekend', rate: 1.2 }, { type: 'holiday', rate: 1.8, dates: ['2026-10-02'] }]),
    ).toBe('holiday');
  });
});
