import { describe, expect, test } from 'vitest';
import { buildCityIndex } from './city-catalog';
import { TenantRouterService } from './tenant-router.service';

const channel = (id: string, servingCities: string[]) => ({
    id, code: `c${id}`, token: `t${id}`, name: `店${id}`, servingCities,
});

function makeRouter(channels: ReturnType<typeof channel>[]) {
    const index = buildCityIndex(channels);
    const catalog = { getIndex: async () => index };
    return new TenantRouterService(catalog as any);
}

describe('TenantRouterService.resolve', () => {
    test('当前渠道不限城市、目标渠道显式服务该城市 → 切店', async () => {
        const router = makeRouter([channel('1', []), channel('111', ['220200'])]);
        const r = await router.resolve({} as any, { cityCode: '220200', currentChannelId: '1' });
        expect(r.chosen?.channelId).toBe('111');
    });

    test('当前渠道已显式服务该城市 → 同精度不切店', async () => {
        const router = makeRouter([channel('1', []), channel('111', ['220200'])]);
        const r = await router.resolve({} as any, { cityCode: '220200', currentChannelId: '111' });
        expect(r.chosen).toBeNull();
        expect(r.currentInCandidates).toBe(true);
    });

    test('当前渠道显式但地址城市不命中、无更高精度候选 → 不切店（交给守卫拒绝）', async () => {
        const router = makeRouter([channel('1', []), channel('111', ['220200'])]);
        const r = await router.resolve({} as any, { cityCode: '110100', currentChannelId: '111' });
        expect(r.chosen).toBeNull();
    });

    test('当前渠道不服务该城市、另有渠道显式服务 → 切到该渠道', async () => {
        const router = makeRouter([channel('111', ['220200']), channel('222', ['220100'])]);
        const r = await router.resolve({} as any, { cityCode: '220100', currentChannelId: '111' });
        expect(r.chosen?.channelId).toBe('222');
    });

    test('所有渠道都未配置服务城市 → 不切店', async () => {
        const router = makeRouter([channel('1', []), channel('7', [])]);
        const r = await router.resolve({} as any, { cityCode: '220200', currentChannelId: '1' });
        expect(r.chosen).toBeNull();
    });
});
