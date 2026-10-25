// P3-2 黑名单自动规则单测：按店铺阈值扫「顾客主动取消」达标顾客并幂等入库
import { describe, expect, it, vi } from 'vitest';
import { BlacklistAutoScanJob } from './blacklist-scan.job';

function make(opts?: { configs?: any[]; hits?: any[]; inserted?: any[][] }) {
    const query = vi.fn(async (sql: string) => {
        if (sql.includes('campus_fulfillment_config')) return opts?.configs ?? [];
        if (sql.includes('FROM "order"')) return opts?.hits ?? [];
        if (sql.includes('INSERT INTO campus_blacklist')) {
            return opts?.inserted?.shift() ?? [];
        }
        return [];
    });
    const feishu = { pushEvent: vi.fn().mockResolvedValue(true) } as any;
    const job = new BlacklistAutoScanJob({ rawConnection: { query } } as any, feishu);
    return { job, query, feishu };
}

describe('BlacklistAutoScanJob', () => {
    it('阈值命中的顾客写入黑名单并推飞书汇总', async () => {
        const { job, feishu } = make({
            configs: [{ channelId: 2, threshold: 2 }],
            hits: [{ customerId: 55, cnt: 3 }],
            inserted: [[{ id: 900 }]],
        });
        const res = await job.scan();
        expect(res).toEqual({ added: 1, channels: 1 });
        expect(feishu.pushEvent.mock.calls[0][0]).toBe('blacklist_auto');
        expect(feishu.pushEvent.mock.calls[0][2]).toContain('自动加入黑名单 1 人');
        expect(feishu.pushEvent.mock.calls[0][2]).toContain('店铺 2');
    });

    it('已存在生效记录（INSERT 未返回行）不计数、不推飞书', async () => {
        const { job, feishu } = make({
            configs: [{ channelId: 2, threshold: 2 }],
            hits: [{ customerId: 55, cnt: 3 }],
            inserted: [[]],
        });
        await expect(job.scan()).resolves.toEqual({ added: 0, channels: 1 });
        expect(feishu.pushEvent).not.toHaveBeenCalled();
    });

    it('阈值为 0 的店铺不参与扫描', async () => {
        const { job, query } = make({ configs: [], hits: [] });
        await expect(job.scan()).resolves.toEqual({ added: 0, channels: 0 });
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('同日重复 runOnce 直接跳过（防多轮刷库）', async () => {
        const { job, query } = make({ configs: [], hits: [] });
        await job.runOnce();
        const calls = query.mock.calls.length;
        await expect(job.runOnce()).resolves.toEqual({ added: 0, channels: 0 });
        expect(query.mock.calls.length).toBe(calls);
    });
});
