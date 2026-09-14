import { describe, expect, it } from 'vitest';
import { ROOM_TEMPLATE_SEEDS, DEFAULT_PRICE_CALENDAR, buildSeedTemplate } from './room-template-seeds';
import { resolveSeedActions } from './room-template-seed-logic';
import { validateHotelConfig } from './hotel-config';

describe('RoomTemplate seeds', () => {
    it('库存恰好 18 种且 code 唯一', () => {
        const codes = ROOM_TEMPLATE_SEEDS.map((s) => s.code);
        expect(codes.length).toBe(18);
        expect(new Set(codes).size).toBe(18);
    });

    it('每种种子经 buildSeedTemplate + validateHotelConfig 校验通过', () => {
        for (const seed of ROOM_TEMPLATE_SEEDS) {
            const tpl = buildSeedTemplate(seed);
            const check = validateHotelConfig({ basePriceCent: tpl.basePriceCent, priceCalendar: tpl.priceCalendar ?? undefined, specs: tpl.specs ?? undefined });
            expect(check.valid, `${seed.code}: ${check.errors.join('; ')}`).toBe(true);
        }
    });

    it('默认 6 间房间、房间号/楼层/景观合法', () => {
        const tpl = buildSeedTemplate(ROOM_TEMPLATE_SEEDS[0]);
        expect(tpl.defaultRooms.length).toBe(6);
        for (const r of tpl.defaultRooms!) {
            expect(r.no).toMatch(/^\d+$/);
            expect(r.floor).toBeGreaterThan(0);
            expect(r.view).toBeTruthy();
        }
    });

    it('未含任何既有/deleted code → 全部待插入', () => {
        const out = resolveSeedActions(new Set(), new Set());
        expect(out.length).toBe(18);
    });

    it('已存在同 code → 跳过；已 deleted → 跳过且不补回', () => {
        const out = resolveSeedActions(new Set(['standard-twin']), new Set(['theme-game']));
        expect(out.some((s) => s.code === 'standard-twin')).toBe(false);
        expect(out.some((s) => s.code === 'theme-game')).toBe(false);
        expect(out.some((s) => s.code === 'deluxe-suite')).toBe(true);
    });
});
