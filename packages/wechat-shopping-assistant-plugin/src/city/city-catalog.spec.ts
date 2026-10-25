import { describe, expect, test } from 'vitest';
import { buildCityIndex } from './city-catalog';

const channels = [
    { id: '1', code: 'default', token: 'default-token', name: '平台', servingCities: [] as string[] },
    { id: '111', code: 'limin', token: 'official-20', name: '东利民', servingCities: ['220200'] },
];
const ranges = [
    { channelId: 1, shopId: 1, rangeType: 'all', districtCodes: null, radiusKm: null, centerLat: null, centerLng: null, enabled: true },
    { channelId: 111, shopId: 111, rangeType: 'district', districtCodes: '["220211"]', radiusKm: null, centerLat: null, centerLng: null, enabled: true },
    { channelId: 222, shopId: 222, rangeType: 'circle', districtCodes: null, radiusKm: 3, centerLat: 43.83, centerLng: 126.55, enabled: true },
];

describe('buildCityIndex', () => {
    test('显式 servingCities 优先', () => {
        const index = buildCityIndex(channels, ranges);
        expect(index.byCity.get('220200')?.[0]).toMatchObject({ channelId: '111', precision: 'explicit' });
    });

    test('district 白名单推导上级城市码', () => {
        const index = buildCityIndex(
            [{ ...channels[0], id: '333', servingCities: [] }],
            [{ channelId: 333, shopId: 333, rangeType: 'district', districtCodes: '["220202"]', radiusKm: null, centerLat: null, centerLng: null, enabled: true }],
        );
        expect(index.byCity.get('220200')?.[0]).toMatchObject({ channelId: '333', precision: 'district' });
    });

    test('all 标记 allChannels，不产生城市键', () => {
        const index = buildCityIndex(channels, ranges);
        expect(index.allChannels.map(c => c.channelId)).toContain('1');
    });
});
