import { describe, expect, test } from 'vitest';
import { buildCityIndex } from './city-catalog';

const channels = [
    { id: '1', code: 'default', token: 'default-token', name: '平台', servingCities: [] as string[] },
    { id: '111', code: 'limin', token: 'official-20', name: '东利民', servingCities: ['220200'] },
];

describe('buildCityIndex', () => {
    test('servingCities 生成显式城市候选', () => {
        const index = buildCityIndex(channels);
        expect(index.byCity.get('220200')?.[0]).toMatchObject({ channelId: '111', precision: 'explicit' });
    });

    test('未配置 servingCities 的渠道进 allChannels 兜底', () => {
        const index = buildCityIndex(channels);
        expect(index.allChannels.map(c => c.channelId)).toEqual(['1']);
    });

    test('配置了 servingCities 的渠道不再进 allChannels', () => {
        const index = buildCityIndex(channels);
        expect(index.allChannels.some(c => c.channelId === '111')).toBe(false);
    });

    test('多城市渠道生成多个城市键', () => {
        const index = buildCityIndex([
            { ...channels[1], servingCities: ['220200', '220100'] },
        ]);
        expect([...index.byCity.keys()].sort()).toEqual(['220100', '220200']);
    });
});
