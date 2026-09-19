/** 结算 binding 集合 TTL 缓存：key=`channelId:templateId`，进程内，主动失效 */
export declare class CouponBindingCache {
    private store;
    ttlMs: number;
    constructor(opts?: {
        ttlMs?: number;
    });
    get(key: string, load: () => Promise<any[]>): Promise<any[]>;
    /** 按模板 id 失效（key 形如 `${channelId}:${templateId}`） */
    invalidate(templateId: number | string): void;
    /** 清空全部缓存（测试清理 / 全量失效用） */
    clear(): void;
}
