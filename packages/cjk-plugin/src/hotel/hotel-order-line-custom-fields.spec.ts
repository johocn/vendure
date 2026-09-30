import { describe, expect, it } from 'vitest';
import { hotelOrderLineCustomFields } from './hotel-order-line-custom-fields';

describe('hotelOrderLineCustomFields', () => {
    it('声明 3 个 OrderLine 字段且 public', () => {
        const fields = hotelOrderLineCustomFields.OrderLine!;
        expect(fields.map(f => f.name).sort()).toEqual(['hotelCheckIn', 'hotelCheckOut', 'hotelNights']);
        expect(fields.every(f => f.public === true && f.nullable === true)).toBe(true);
    });
    it('日期为 string、晚数为 int', () => {
        const byName = Object.fromEntries(hotelOrderLineCustomFields.OrderLine!.map(f => [f.name, f.type]));
        expect(byName.hotelCheckIn).toBe('string');
        expect(byName.hotelCheckOut).toBe('string');
        expect(byName.hotelNights).toBe('int');
    });
    it('字段带中英 label', () => {
        const f = hotelOrderLineCustomFields.OrderLine!.find(x => x.name === 'hotelCheckIn')!;
        const langs = (f.label ?? []).map(l => l.languageCode);
        expect(langs).toContain('zh_Hans');
        expect(langs).toContain('en');
    });
});
