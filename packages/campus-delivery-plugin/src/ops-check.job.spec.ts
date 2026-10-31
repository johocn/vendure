// R8 遗留巡检：只在巡检时间后跑一次、全零不发、非零汇总推送、多实例抢锁跳过
import { describe, expect, it, vi } from 'vitest';

import { OpsCheckJob } from './ops-check.job';

// 2026-10-31 09:00（UTC+8）→ UTC 01:00
const AT_NOW = Date.UTC(2026, 9, 31, 1, 0, 0);
const BEFORE = Date.UTC(2026, 9, 31, 0, 30, 0); // 08:30 UTC+8

function make(counts: Array<number | Error> = [0, 0, 0, 0, 0], lockOk = true) {
    let i = 0;
    const query = vi.fn(async () => {
        const c = counts[i++];
        if (c instanceof Error) throw c;
        return [[{ n: c }], []];
    });
    const runner = {
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(async (sql: string) => {
            if (sql.includes('pg_try_advisory_lock')) return [[{ ok: lockOk }], []];
            return [[], []];
        }),
        release: vi.fn().mockResolvedValue(undefined),
    };
    const pushEvent = vi.fn().mockResolvedValue(true);
    const job = new OpsCheckJob(
        { rawConnection: { query, createQueryRunner: () => runner } } as any,
        { pushEvent } as any,
    );
    return { job, query, pushEvent, runner };
}

describe('OpsCheckJob', () => {
    it('未到巡检时间 → 不查库不推送', async () => {
        const { job, query, pushEvent } = make();
        expect(await job.runOnce(BEFORE)).toBeNull();
        expect(query).not.toHaveBeenCalled();
        expect(pushEvent).not.toHaveBeenCalled();
    });

    it('全部指标为 0 → 不发消息（但当天不再重复执行）', async () => {
        const { job, pushEvent } = make([0, 0, 0, 0, 0]);
        expect(await job.runOnce(AT_NOW)).toBeNull();
        expect(pushEvent).not.toHaveBeenCalled();
        expect(await job.runOnce(AT_NOW)).toBeNull(); // 进程内按天去重
    });

    it('非零指标 → 汇总推送（含标签与数值）', async () => {
        const { job, pushEvent } = make([0, 3, 0, 1, 0]);
        const text = await job.runOnce(AT_NOW);
        expect(text).toContain('退款失败待人工：3');
        expect(text).toContain('补偿任务失败：1');
        expect(pushEvent).toHaveBeenCalledWith(
            'alert',
            '遗留巡检 2026-10-31',
            expect.stringContaining('退款失败待人工：3'),
            undefined,
            'ops_check:2026-10-31',
        );
    });

    it('单项查询失败 → 跳过该项，其余正常汇总', async () => {
        const { job, pushEvent } = make([new Error('table missing'), 2, 0, 0, 0]);
        const text = await job.runOnce(AT_NOW);
        expect(text).toContain('退款失败待人工：2');
        expect(pushEvent).toHaveBeenCalled();
    });

    it('其他实例持有锁 → 本轮跳过', async () => {
        const { job, query, pushEvent } = make([1, 1, 1, 1, 1], false);
        expect(await job.runOnce(AT_NOW)).toBeNull();
        expect(query).not.toHaveBeenCalled();
        expect(pushEvent).not.toHaveBeenCalled();
    });
});
