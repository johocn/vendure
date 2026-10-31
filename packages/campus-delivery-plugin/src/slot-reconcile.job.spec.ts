// R3 锁位对账：偏差才告警、24h 去重、多类偏差分别告警
import { describe, expect, it, vi } from 'vitest';

import { SlotReconcileJob } from './slot-reconcile.job';

function make(rows: any[]) {
    const query = vi.fn().mockResolvedValue([rows, []]);
    const pushEvent = vi.fn().mockResolvedValue(true);
    const job = new SlotReconcileJob(
        { rawConnection: { query } } as any,
        { pushEvent } as any,
    );
    return { job, query, pushEvent };
}

describe('SlotReconcileJob', () => {
    it('无偏差 → 不告警', async () => {
        const { job, pushEvent } = make([]);
        expect(await job.runOnce(1000)).toEqual([]);
        expect(pushEvent).not.toHaveBeenCalled();
    });

    it('容量多计 → 告警（24h 内同 key 只告警一次）', async () => {
        const { job, pushEvent } = make([
            { id: 3, slotDate: '2026-10-31', startTime: '11:00', endTime: '11:30', lockedCount: 3, ordersLocked: 2, cancelledLocked: 0 },
        ]);
        const first = await job.runOnce(1000);
        expect(first).toHaveLength(1);
        expect(pushEvent).toHaveBeenCalledTimes(1);
        expect(pushEvent.mock.calls[0][1]).toBe('锁位容量多计');
        expect(pushEvent.mock.calls[0][4]).toBe('slot_reconcile:3:2026-10-31:over');
        await job.runOnce(1000 + 60_000);
        expect(pushEvent).toHaveBeenCalledTimes(1);
        await job.runOnce(1000 + 24 * 3600_000);
        expect(pushEvent).toHaveBeenCalledTimes(2);
    });

    it('容量少计 → 单独告警', async () => {
        const { job, pushEvent } = make([
            { id: 4, slotDate: '2026-10-31', startTime: '12:00', endTime: '12:30', lockedCount: 1, ordersLocked: 3, cancelledLocked: 0 },
        ]);
        await job.runOnce(1000);
        expect(pushEvent.mock.calls[0][1]).toBe('锁位容量少计');
        expect(pushEvent.mock.calls[0][4]).toBe('slot_reconcile:4:2026-10-31:under');
    });

    it('已取消仍占位 → 取消未释放告警（可与容量偏差同时出现）', async () => {
        const { job, pushEvent } = make([
            { id: 5, slotDate: '2026-10-31', startTime: '13:00', endTime: '13:30', lockedCount: 2, ordersLocked: 1, cancelledLocked: 1 },
        ]);
        await job.runOnce(1000);
        expect(pushEvent.mock.calls.map(c => c[4]).sort()).toEqual([
            'slot_reconcile:5:2026-10-31:cancel',
            'slot_reconcile:5:2026-10-31:over',
        ]);
    });
});
