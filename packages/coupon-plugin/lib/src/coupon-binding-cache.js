"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponBindingCache = void 0;
/** 结算 binding 集合 TTL 缓存：key=`channelId:templateId`，进程内，主动失效 */
class CouponBindingCache {
    constructor(opts) {
        var _a;
        this.store = new Map();
        this.ttlMs = (_a = opts === null || opts === void 0 ? void 0 : opts.ttlMs) !== null && _a !== void 0 ? _a : 4000;
    }
    async get(key, load) {
        const hit = this.store.get(key);
        if (hit && hit.until > Date.now())
            return hit.value;
        const value = await load();
        this.store.set(key, { until: Date.now() + this.ttlMs, value });
        return value;
    }
    /** 按模板 id 失效（key 形如 `${channelId}:${templateId}`） */
    invalidate(templateId) {
        const suffix = `:${templateId}`;
        for (const key of this.store.keys()) {
            if (key.endsWith(suffix))
                this.store.delete(key);
        }
    }
    /** 清空全部缓存（测试清理 / 全量失效用） */
    clear() {
        this.store.clear();
    }
}
exports.CouponBindingCache = CouponBindingCache;
//# sourceMappingURL=coupon-binding-cache.js.map