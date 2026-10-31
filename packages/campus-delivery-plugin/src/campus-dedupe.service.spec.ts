import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampusDedupeService } from './campus-dedupe.service';

function memoryService(): CampusDedupeService {
    process.env.CAMPUS_DEDUPE_DRIVER = 'memory';
    return new CampusDedupeService({ rawConnection: { options: { type: 'sqlite' }, query: vi.fn() } } as any);
}

function dbService(query: any): CampusDedupeService {
    process.env.CAMPUS_DEDUPE_DRIVER = 'db';
    return new CampusDedupeService({ rawConnection: { options: { type: 'postgres' }, query } } as any);
}

afterEach(() => {
    delete process.env.CAMPUS_DEDUPE_DRIVER;
    delete process.env.CAMPUS_INSTANCE_COUNT;
    vi.restoreAllMocks();
});

describe('CampusDedupeService（memory）', () => {
    it('seen 只读；mark 后进入窗口；窗口过期自动失效', async () => {
        const svc = memoryService();
        vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        expect(await svc.seen('k', 60_000)).toBe(false);
        await svc.mark('k', 60_000);
        expect(await svc.seen('k', 60_000)).toBe(true);
        vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 61_000);
        expect(await svc.seen('k', 60_000)).toBe(false);
    });

    it('seenOrMark 首次抢占成功，再次调用命中窗口', async () => {
        const svc = memoryService();
        expect(await svc.seenOrMark('k', 60_000)).toBe(false);
        expect(await svc.seenOrMark('k', 60_000)).toBe(true);
    });

    it('incr 窗口内累加，过期重置为 1', async () => {
        const svc = memoryService();
        vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
        expect(await svc.incr('k', 60_000)).toBe(1);
        expect(await svc.incr('k', 60_000)).toBe(2);
        vi.spyOn(Date, 'now').mockReturnValue(2_000_000 + 61_000);
        expect(await svc.incr('k', 60_000)).toBe(1);
    });

    it('setJson/getJson/del 带 TTL', async () => {
        const svc = memoryService();
        vi.spyOn(Date, 'now').mockReturnValue(3_000_000);
        await svc.setJson('k', { a: 1 }, 60_000);
        expect(await svc.getJson('k')).toEqual({ a: 1 });
        vi.spyOn(Date, 'now').mockReturnValue(3_000_000 + 61_000);
        expect(await svc.getJson('k')).toBeNull();
        await svc.setJson('k2', { b: 2 }, 60_000);
        await svc.del('k2');
        expect(await svc.getJson('k2')).toBeNull();
    });
});

describe('CampusDedupeService（db）', () => {
    it('seenOrMark 抢占成功=false；冲突（无返回行）=true', async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce([[]]) // DELETE 过期行
            .mockResolvedValueOnce([[{ key: 'k' }]]) // INSERT RETURNING → 抢占成功
            .mockResolvedValueOnce([[]]) // DELETE
            .mockResolvedValueOnce([[]]); // INSERT 冲突 → 已存在
        const svc = dbService(query);
        expect(await svc.seenOrMark('k', 60_000)).toBe(false);
        expect(await svc.seenOrMark('k', 60_000)).toBe(true);
        const sql = String(query.mock.calls[1][0]);
        expect(sql).toContain('ON CONFLICT');
        expect(sql).toContain('RETURNING');
    });

    it('incr 读取 RETURNING counter', async () => {
        const query = vi.fn().mockResolvedValue([[{ counter: 3 }]]);
        const svc = dbService(query);
        expect(await svc.incr('k', 60_000)).toBe(3);
    });

    it('db 不可用 → 降级内存，语义仍生效（仅告警一次）', async () => {
        const query = vi.fn().mockRejectedValue(new Error('relation does not exist'));
        const svc = dbService(query);
        expect(await svc.seenOrMark('k', 60_000)).toBe(false);
        expect(await svc.seenOrMark('k', 60_000)).toBe(true);
    });

    it('setJson/getJson 读写 value（jsonb 对象已是对象）', async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[{ value: { a: 1 } }]])
            .mockResolvedValueOnce([[]]);
        const svc = dbService(query);
        await svc.setJson('k', { a: 1 }, 60_000);
        expect(await svc.getJson('k')).toEqual({ a: 1 });
    });
});
