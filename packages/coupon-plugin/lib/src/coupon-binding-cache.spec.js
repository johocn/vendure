"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_binding_cache_1 = require("./coupon-binding-cache");
(0, vitest_1.describe)('CouponBindingCache', () => {
    let cache;
    (0, vitest_1.beforeEach)(() => {
        cache = new coupon_binding_cache_1.CouponBindingCache({ ttlMs: 4000 });
    });
    (0, vitest_1.it)('TTL 内重复 get(k, fn) 只调一次 load', async () => {
        const load = vitest_1.vi.fn().mockResolvedValue([{ id: 1 }]);
        await cache.get('1:2', load);
        await cache.get('1:2', load);
        await cache.get('1:2', load);
        (0, vitest_1.expect)(load).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(await cache.get('1:2', load)).toEqual([{ id: 1 }]);
    });
    (0, vitest_1.it)('TTL 过期后重新 load', async () => {
        // 用负 TTL：每次写入即已过期，保证第二次 get 重新 load
        const cache = new coupon_binding_cache_1.CouponBindingCache({ ttlMs: -1 });
        const load = vitest_1.vi.fn().mockResolvedValue([{ id: 1 }]);
        await cache.get('1:2', load);
        await cache.get('1:2', load);
        (0, vitest_1.expect)(load).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)('invalidate(templateId) 使该模板下所有渠道前缀的 key 失效', async () => {
        const load = vitest_1.vi.fn().mockResolvedValue([{ id: 1 }]);
        await cache.get('1:2', load);
        await cache.get('7:2', load);
        await cache.get('1:9', load);
        (0, vitest_1.expect)(load).toHaveBeenCalledTimes(3);
        cache.invalidate(2); // 只失效 templateId=2 的两个 key
        await cache.get('1:2', load);
        await cache.get('7:2', load);
        await cache.get('1:9', load);
        // templateId=2 两条重查；templateId=9 命中缓存
        (0, vitest_1.expect)(load).toHaveBeenCalledTimes(5);
    });
    (0, vitest_1.it)('不同 key 相互隔离', async () => {
        const load1 = vitest_1.vi.fn().mockResolvedValue([{ a: 1 }]);
        const load2 = vitest_1.vi.fn().mockResolvedValue([{ b: 2 }]);
        await cache.get('1:2', load1);
        await cache.get('3:4', load2);
        (0, vitest_1.expect)(await cache.get('3:4', load2)).toEqual([{ b: 2 }]);
        (0, vitest_1.expect)(load2).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=coupon-binding-cache.spec.js.map