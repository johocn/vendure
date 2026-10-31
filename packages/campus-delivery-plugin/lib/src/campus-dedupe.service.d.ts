import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
export type CampusDedupeDriver = 'memory' | 'db' | 'redis';
/**
 * 跨实例去重/限频（M4）。
 *
 * 插件里大量「冷却/限频/待确认」状态原先放在进程内 Map：
 * 单实例够用，多实例（pm2 cluster / 容器多副本）下每个进程各算各的，
 * 冷却形同虚设（同一告警会被多个实例重复推送）。本服务把状态收敛到统一后端：
 *
 * - memory：进程内 Map（默认；单实例/单测）；
 * - db：`campus_dedupe_key` 表（Postgres，p38 迁移建表；跨实例共享）；
 * - redis：`CAMPUS_DEDUPE_DRIVER=redis` 且已安装 redis 客户端时使用，失败回退 db。
 *
 * 语义约定（调用方据此替换原 Map 逻辑）：
 * - `seen(key, ttl)`：只读判断是否仍在窗口内，不写入（用于「是否重复」的前置检查）；
 * - `mark(key, ttl)`：写入/续期窗口（用于送达成功后才开始冷却）；
 * - `seenOrMark(key, ttl)`：原子「查并写」，返回 true 表示窗口内已存在（用于告警限频）；
 * - `incr(key, windowMs)`：窗口内计数 +1（窗口过期重新从 1 开始），返回当前次数；
 * - `setJson/getJson/del`：带 TTL 的任意状态（飞书待确认指令等）。
 *
 * 所有方法都不会抛异常：后端不可用时降级为内存实现（只记一次日志），
 * 保证去重/限频失效也绝不阻断主流程。
 */
export declare class CampusDedupeService implements OnApplicationShutdown {
    private connection;
    private readonly memory;
    private readonly driver;
    private readonly instanceCount;
    private redis;
    private redisLoading;
    private redisBroken;
    private dbBroken;
    private cleanup;
    constructor(connection: TransactionalConnection);
    onApplicationShutdown(): void;
    get backend(): CampusDedupeDriver;
    seen(key: string, ttlMs?: number): Promise<boolean>;
    mark(key: string, ttlMs?: number): Promise<void>;
    /** 返回 true 表示窗口内已存在（本次不再执行）；false 表示本次抢占成功 */
    seenOrMark(key: string, ttlMs?: number): Promise<boolean>;
    /** 窗口内计数（过期自动重置为 1） */
    incr(key: string, windowMs?: number): Promise<number>;
    setJson(key: string, value: unknown, ttlMs?: number): Promise<void>;
    getJson<T = unknown>(key: string): Promise<T | null>;
    del(key: string): Promise<void>;
    private validMemory;
    private memorySeen;
    private memorySet;
    private raw;
    private rows;
    private dbSeen;
    private dbMark;
    private dbSeenOrMark;
    private dbIncr;
    private dbSetJson;
    private dbGetJson;
    /** 首次失败记一次告警（后续静默，避免刷屏） */
    private warnDbOnce;
    private withRedis;
    private redisClient;
    private cleanupOnce;
}
