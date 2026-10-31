// advisory lock helper：拿锁执行、拿不到跳过、异常仍释放、sqlite 降级直接执行
import { Logger } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';

import { withAdvisoryLock } from './advisory-lock';

function make(opts?: { lockOk?: boolean; lockError?: Error }) {
    const query = vi.fn(async (sql: string) => {
        if (sql.includes('pg_try_advisory_lock')) {
            if (opts?.lockError) throw opts.lockError;
            return [[{ ok: opts?.lockOk ?? true }], []];
        }
        return [];
    });
    const runner = {
        connect: vi.fn().mockResolvedValue(undefined),
        query,
        release: vi.fn().mockResolvedValue(undefined),
    };
    const connection = { rawConnection: { createQueryRunner: () => runner } } as any;
    return { connection, query, runner };
}

describe('withAdvisoryLock', () => {
    it('拿到锁 → 执行 fn，结束后解锁并释放连接', async () => {
        const { connection, query, runner } = make();
        const result = await withAdvisoryLock(connection, 'campus:test', async () => 'done');
        expect(result).toBe('done');
        expect(query.mock.calls.some(c => String(c[0]).includes('pg_advisory_unlock'))).toBe(true);
        expect(runner.release).toHaveBeenCalled();
    });

    it('拿不到锁 → 跳过 fn 并释放连接', async () => {
        const { connection, query, runner } = make({ lockOk: false });
        const fn = vi.fn().mockResolvedValue('should-not-run');
        expect(await withAdvisoryLock(connection, 'campus:test', fn)).toBeUndefined();
        expect(fn).not.toHaveBeenCalled();
        expect(query.mock.calls.some(c => String(c[0]).includes('pg_advisory_unlock'))).toBe(false);
        expect(runner.release).toHaveBeenCalled();
    });

    it('fn 抛错 → 仍然解锁并释放连接，异常向上抛出', async () => {
        const { connection, query, runner } = make();
        await expect(
            withAdvisoryLock(connection, 'campus:test', async () => {
                throw new Error('boom');
            }),
        ).rejects.toThrow('boom');
        expect(query.mock.calls.some(c => String(c[0]).includes('pg_advisory_unlock'))).toBe(true);
        expect(runner.release).toHaveBeenCalled();
    });

    it('锁查询失败（sqlite 等环境）→ 记 warn 并直接执行 fn', async () => {
        const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined as any);
        const { connection, runner } = make({ lockError: new Error('no such function: pg_try_advisory_lock') });
        expect(await withAdvisoryLock(connection, 'campus:test', async () => 'fallback')).toBe('fallback');
        expect(warn).toHaveBeenCalled();
        expect(runner.release).toHaveBeenCalled();
        warn.mockRestore();
    });
});
