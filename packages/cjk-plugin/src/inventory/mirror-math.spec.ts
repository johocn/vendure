import { describe, expect, it } from 'vitest';
import { calcMirrorDelta, haversineKm, pickLocationsByIds, sumBoundOnHand } from './mirror-math';

describe('mirror-math', () => {
    it('sumBoundOnHand 只累加绑定仓', () => {
        const levels = [
            { locationId: 'l1', onHand: 5 },
            { locationId: 'l2', onHand: 7 },
            { locationId: 'v1', onHand: 100 },
        ];
        expect(sumBoundOnHand(levels, ['l1', 'l2'])).toBe(12);
    });

    it('calcMirrorDelta = boundTotal - currentVirtual', () => {
        expect(calcMirrorDelta(10, 12)).toBe(2);
        expect(calcMirrorDelta(10, 8)).toBe(-2);
        expect(calcMirrorDelta(10, 10)).toBe(0);
    });

    it('pickLocationsByIds 过滤出绑定物理仓', () => {
        const locs = [
            { id: 'l1' as string, name: 'a' },
            { id: 'l2' as string, name: 'b' },
            { id: 'v1' as string, name: 'v' },
        ];
        expect(pickLocationsByIds(locs, ['l1', 'l2']).map(l => l.id)).toEqual(['l1', 'l2']);
    });

    it('haversineKm 距离计算', () => {
        // 北京天安门 ~ 上海人民广场，约 1067 km
        const km = haversineKm(39.9087, 116.3975, 31.2304, 121.4737);
        expect(km).toBeGreaterThan(1000);
        expect(km).toBeLessThan(1150);
    });

    it('haversineKm 同点距离为 0', () => {
        expect(haversineKm(30, 120, 30, 120)).toBe(0);
    });
});
