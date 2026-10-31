// R2 补偿重试：认领后执行、退避、耗尽告警、notify 重放
import { describe, expect, it, vi } from 'vitest';

import { CompensationRetryJob } from './compensation-retry.job';

const pc = { channelId: 1, apiType: 'admin' } as any;

function make(tasks: any[] = []) {
    const due = vi.fn().mockResolvedValue(tasks);
    const claim = vi.fn().mockResolvedValue(true);
    const markDone = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const retryInApp = vi.fn().mockResolvedValue(undefined);
    const pushEvent = vi.fn().mockResolvedValue(true);
    const grantCoupon = vi.fn();
    const job = new CompensationRetryJob(
        { due, claim, markDone, markFailed } as any,
        { retryInApp } as any,
        { pushEvent } as any,
        { create: vi.fn().mockResolvedValue(pc) } as any,
        { get: vi.fn() } as any,
    );
    job.couponOverride = { grantCoupon };
    return { job, due, claim, markDone, markFailed, retryInApp, pushEvent, grantCoupon };
}

const task = (over: Record<string, any> = {}) => ({
    id: 1,
    attempts: 0,
    kind: 'coupon',
    orderId: 3,
    channelId: 1,
    customerId: 9,
    payload: JSON.stringify({ templateId: 't1', orderCode: 'ORD1' }),
    dedupeKey: 'coupon:ORD1:t1',
    ...over,
});

describe('CompensationRetryJob', () => {
    it('券补发成功 → 标记 done', async () => {
        const { job, grantCoupon, markDone } = make([task()]);
        grantCoupon.mockResolvedValue(['c1']);
        const res = await job.runOnce();
        expect(grantCoupon).toHaveBeenCalledWith(pc, 't1', [9]);
        expect(markDone).toHaveBeenCalledWith(1);
        expect(res).toEqual({ done: 1, retried: 0, failed: 0 });
    });

    it('失败未耗尽 → 回 pending 并按退避排下次（1 分钟）', async () => {
        const { job, grantCoupon, markFailed } = make([task()]);
        // 用同步 throw 避免异步 mock 产生未消费的 rejected promise
        grantCoupon.mockImplementation(() => {
            throw new Error('coupon down');
        });
        const before = Date.now();
        const res = await job.runOnce();
        const [, exhausted, msg, next] = markFailed.mock.calls[0];
        expect(exhausted).toBe(false);
        expect(msg).toContain('coupon down');
        expect(next.getTime() - before).toBeGreaterThanOrEqual(59_000);
        expect(res).toEqual({ done: 0, retried: 1, failed: 0 });
    });

    it('第 5 次失败 → failed + 告警一次', async () => {
        const { job, grantCoupon, markFailed, pushEvent } = make([task({ attempts: 4 })]);
        grantCoupon.mockImplementation(() => {
            throw new Error('still down');
        });
        const res = await job.runOnce();
        expect(markFailed).toHaveBeenCalledWith(1, true, expect.stringContaining('still down'), null);
        expect(pushEvent).toHaveBeenCalledWith(
            'alert',
            '补偿任务重试耗尽',
            expect.stringContaining('订单 3'),
            undefined,
            'compensation_exhausted:coupon:ORD1:t1',
        );
        expect(res.failed).toBe(1);
    });

    it('认领失败（其他实例已处理）→ 跳过', async () => {
        const { job, claim, markDone } = make([task()]);
        claim.mockResolvedValue(false);
        await job.runOnce();
        expect(markDone).not.toHaveBeenCalled();
    });

    it('notify 任务 → 重放站内信写入', async () => {
        const { job, retryInApp, markDone } = make([
            task({ kind: 'notify', payload: JSON.stringify({ event: 'arrivedHandover', text: '东区交接点' }) }),
        ]);
        await job.runOnce();
        expect(retryInApp).toHaveBeenCalledWith(3, 1, 'arrivedHandover', '东区交接点');
        expect(markDone).toHaveBeenCalledWith(1);
    });
});
