import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CouponBindingCache } from './coupon-binding-cache';

describe('CouponBindingCache', () => {
    let cache: CouponBindingCache;

    beforeEach(() => {
        cache = new CouponBindingCache({ ttlMs: 4000 });
    });

    it('TTL 内重复 get(k, fn) 只调一次 load', async () => {
        const load = vi.fn().mockResolvedValue([{ id: 1 }]);
        await cache.get('1:2', load);
        await cache.get('1:2', load);
        await cache.get('1:2', load);
        expect(load).toHaveBeenCalledTimes(1);
        expect(await cache.get('1:2', load)).toEqual([{ id: 1 }]);
    });

    it('TTL 过期后重新 load', async () => {
        // 用负 TTL：每次写入即已过期，保证第二次 get 重新 load
        const cache = new CouponBindingCache({ ttlMs: -1 });
        const load = vi.fn().mockResolvedValue([{ id: 1 }]);
        await cache.get('1:2', load);
        await cache.get('1:2', load);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('invalidate(templateId) 使该模板下所有渠道前缀的 key 失效', async () => {
        const load = vi.fn().mockResolvedValue([{ id: 1 }]);
        await cache.get('1:2', load);
        await cache.get('7:2', load);
        await cache.get('1:9', load);
        expect(load).toHaveBeenCalledTimes(3);

        cache.invalidate(2); // 只失效 templateId=2 的两个 key
        await cache.get('1:2', load);
        await cache.get('7:2', load);
        await cache.get('1:9', load);
        // templateId=2 两条重查；templateId=9 命中缓存
        expect(load).toHaveBeenCalledTimes(5);
    });

    it('不同 key 相互隔离', async () => {
        const load1 = vi.fn().mockResolvedValue([{ a: 1 }]);
        const load2 = vi.fn().mockResolvedValue([{ b: 2 }]);
        await cache.get('1:2', load1);
        await cache.get('3:4', load2);
        expect(await cache.get('3:4', load2)).toEqual([{ b: 2 }]);
        expect(load2).toHaveBeenCalledTimes(1);
    });
});