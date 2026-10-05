import { describe, expect, it } from 'vitest';
import { campusCustomFields } from './custom-fields';

describe('campusCustomFields', () => {
    it('Channel 含 waimai 四字段（tags/monthlySales/logo/promoText）', () => {
        const names = (campusCustomFields.Channel ?? []).map(f => f.name);
        expect(names).toContain('waimaiTags');
        expect(names).toContain('waimaiMonthlySales');
        expect(names).toContain('waimaiLogo');
        expect(names).toContain('waimaiPromoText');
    });
    it('Order 含转单存证字段', () => {
        const names = campusCustomFields.Order.map(f => f.name);
        expect(names).toContain('transferPhotos');
        expect(names).toContain('transferNote');
        expect(names).toContain('transferAt');
    });
});
