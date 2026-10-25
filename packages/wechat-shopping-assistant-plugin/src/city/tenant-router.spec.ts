import { describe, expect, test } from 'vitest';
import { rankCandidates, Candidate } from './tenant-router';

const c = (over: Partial<Candidate>): Candidate => ({
    channelId: '1', channelCode: 'a', channelToken: 't', channelName: 'A',
    precision: 'all', minOrderAmount: 0, deliveryMinutes: 30, storeId: null,
    centerLat: null, centerLng: null, distanceKm: null,
    ...over,
});

describe('rankCandidates', () => {
    test('精度：explicit > district > circle > all', () => {
        const r = rankCandidates([c({ channelId: 'a', precision: 'all' }), c({ channelId: 'b', precision: 'circle', distanceKm: 1 }), c({ channelId: 'c', precision: 'district' })], {});
        expect(r.map(x => x.channelId)).toEqual(['c', 'b', 'a']);
    });
    test('同精度按起送价、时效、距离', () => {
        const r = rankCandidates(
            [
                c({ channelId: 'a', precision: 'district', minOrderAmount: 2000 }),
                c({ channelId: 'b', precision: 'district', minOrderAmount: 0, deliveryMinutes: 20 }),
                c({ channelId: 'c', precision: 'district', minOrderAmount: 0, deliveryMinutes: 40 }),
            ],
            {},
        );
        expect(r.map(x => x.channelId)).toEqual(['b', 'c', 'a']);
    });
    test('半径候选按距离过滤超出 0 结果的项', () => {
        const r = rankCandidates([c({ channelId: 'a', precision: 'circle', distanceKm: 5 })], { maxDistanceKm: 3 });
        expect(r).toEqual([]);
    });
    test('同渠道多精度命中：去重保留最高精度', () => {
        const r = rankCandidates(
            [c({ channelId: 'a', precision: 'all' }), c({ channelId: 'a', precision: 'explicit' })],
            {},
        );
        expect(r).toHaveLength(1);
        expect(r[0].precision).toBe('explicit');
    });
});
