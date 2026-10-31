// R2 补偿任务持久化：入队幂等（唯一键 ON CONFLICT）、条件认领、耗尽标记
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompensationTaskService } from './compensation-task.service';

const pc = { channelId: 1, apiType: 'admin' } as any;

function make() {
    const query = vi.fn().mockResolvedValue([[], []]);
    const find = vi.fn().mockResolvedValue([]);
    const conn = {
        rawConnection: { query },
        getRepository: vi.fn(() => ({ find })),
    } as any;
    const svc = new CompensationTaskService(conn, { create: vi.fn().mockResolvedValue(pc) } as any);
    return { svc, query, find };
}

describe('CompensationTaskService', () => {
    beforeEach(() => vi.clearAllMocks());

    it('enqueueCoupon：按「单号+模板」唯一入队（ON CONFLICT 幂等）', async () => {
        const { svc, query } = make();
        await svc.enqueueCoupon({ orderId: 3, channelId: 1, customerId: 9, templateId: 't1', orderCode: 'ORD1' });
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT ("dedupeKey") DO NOTHING'),
            expect.arrayContaining([3, 1, 9, 'coupon', expect.any(String), 'coupon:ORD1:t1', expect.any(Date)]),
        );
    });

    it('enqueueNotify：同单同事件（含后缀）唯一入队', async () => {
        const { svc, query } = make();
        await svc.enqueueNotify({ orderId: 5, channelId: 7, customerId: 21, event: 'arrivedHandover', suffix: 's1' });
        expect(query).toHaveBeenCalledWith(
            expect.any(String),
            expect.arrayContaining(['notify:5:arrivedHandover:s1']),
        );
    });

    it('入队失败只记日志，不抛出（补偿是旁路）', async () => {
        const { svc, query } = make();
        query.mockRejectedValueOnce(new Error('db down'));
        await expect(
            svc.enqueueCoupon({ orderId: 3, channelId: 1, customerId: 9, templateId: 't1', orderCode: 'ORD1' }),
        ).resolves.toBeUndefined();
    });

    it('claim：条件命中（pending 且 attempts 未变）才返回 true', async () => {
        const { svc, query } = make();
        query.mockResolvedValueOnce([[{ id: 1 }], []]);
        expect(await svc.claim(1, 0)).toBe(true);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("status = 'pending' AND attempts = $2"), [1, 0]);
        query.mockResolvedValueOnce([[], []]);
        expect(await svc.claim(1, 0)).toBe(false);
    });

    it('markFailed：未耗尽回 pending 并排下次时间；耗尽置 failed 且清空时间', async () => {
        const { svc, query } = make();
        const next = new Date();
        await svc.markFailed(1, false, 'boom', next);
        expect(query).toHaveBeenLastCalledWith(expect.any(String), ['pending', 'boom', next, 1]);
        await svc.markFailed(1, true, 'boom', next);
        expect(query).toHaveBeenLastCalledWith(expect.any(String), ['failed', 'boom', null, 1]);
    });
});
