/**
 * 门店匹配单测：Haversine 距离过滤（3km）、熟店优先排序、异常降级。
 * PickupLocationService / 订单仓储用假件（本插件不直接依赖其运行时行为）。
 */
import { describe, expect, test } from 'vitest';

import { StoreLocatorService } from './store-locator.service';

const ORIGIN = { lat: 39.9087, lng: 116.3975 };

/** 纬度偏移换算：1° ≈ 111.2km（同经度下近似直线距离） */
const atKmNorth = (km: number) => ({ lat: ORIGIN.lat + km / 111.2, lng: ORIGIN.lng });

function makeLocation(id: string, km: number, coords: any = atKmNorth(km)) {
    return {
        id,
        name: `门店${id}`,
        address: `地址${id}`,
        coordinates: coords,
    };
}

function makeQb(rows: any[] | 'error') {
    const qb: any = {};
    for (const method of ['leftJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'limit']) {
        qb[method] = () => qb;
    }
    qb.getRawMany = async () => {
        if (rows === 'error') throw new Error('db down');
        return rows;
    };
    return qb;
}

function makeService(
    locations: any[] | 'error',
    options: { familiarRows?: any[] | 'error'; pickupMissing?: boolean } = {},
) {
    const moduleRef = {
        get: () => {
            if (options.pickupMissing) throw new Error('no provider');
            return {
                findByType: async () => {
                    if (locations === 'error') throw new Error('pickup down');
                    return locations;
                },
            };
        },
    };
    const connection = {
        getRepository: () => ({
            createQueryBuilder: () => makeQb(options.familiarRows ?? []),
        }),
    };
    return new StoreLocatorService(moduleRef as any, connection as any);
}

describe('StoreLocatorService.findNearby', () => {
    test('只保留 3km 内且坐标有效的门店，按距离升序并保留 1 位小数', async () => {
        const svc = makeService([
            makeLocation('n2', 1),
            makeLocation('n1', 0.5),
            makeLocation('far', 8),
            makeLocation('no-coord', 0, null),
            makeLocation('bad-coord', 0, { lat: 'x', lng: null }),
        ]);
        const stores = await svc.findNearby({} as any, ORIGIN.lat, ORIGIN.lng);
        expect(stores.map(s => s.id)).toEqual(['n1', 'n2']);
        expect(stores.map(s => s.distanceKm)).toEqual([0.5, 1]);
        expect(stores.every(s => s.familiar === false)).toBe(true);
    });

    test('熟店优先于更近的门店', async () => {
        const svc = makeService([makeLocation('n1', 0.5), makeLocation('n2', 1)]);
        const stores = await svc.findNearby({} as any, ORIGIN.lat, ORIGIN.lng, {
            familiarStoreIds: new Set(['n2']),
        });
        expect(stores.map(s => s.id)).toEqual(['n2', 'n1']);
        expect(stores[0].familiar).toBe(true);
    });

    test('门店列表异常 / PickupLocationService 不可用 → 空列表（不抛错）', async () => {
        expect(await makeService('error').findNearby({} as any, ORIGIN.lat, ORIGIN.lng)).toEqual([]);
        expect(
            await makeService([], { pickupMissing: true }).findNearby({} as any, ORIGIN.lat, ORIGIN.lng),
        ).toEqual([]);
    });
});

describe('StoreLocatorService.familiarStoreIds', () => {
    test('历史订单门店 id 转字符串集合；无顾客返回空集', async () => {
        const svc = makeService([], { familiarRows: [{ storeId: 3 }, { storeId: '7' }] });
        expect(await svc.familiarStoreIds({} as any, 42)).toEqual(new Set(['3', '7']));
        expect(await svc.familiarStoreIds({} as any, null)).toEqual(new Set());
    });

    test('查询异常 → 空集（熟店仅退化为按距离排序）', async () => {
        const svc = makeService([], { familiarRows: 'error' });
        expect(await svc.familiarStoreIds({} as any, 42)).toEqual(new Set());
    });
});
