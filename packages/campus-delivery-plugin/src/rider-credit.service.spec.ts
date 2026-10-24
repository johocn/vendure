// 纯逻辑单测：原子加减分（+2 完单 / -5 拒单 / 扣到 0 下限）+ 流水落库
import { describe, expect, it, vi } from 'vitest';
import { Logger } from '@vendure/core';
import { RiderCreditService } from './rider-credit.service';

describe('RiderCreditService.adjust', () => {
    const mk = (credit: number, delta: number) => {
        const saved: any[] = [];
        const logRepo = { save: vi.fn().mockImplementation(v => { saved.push(v); return Promise.resolve(v); }) };
        const conn = {
            getRepository: vi.fn(() => logRepo),
            // 原子 UPDATE ... RETURNING 返回 [rows, fields]（与 deliver 原子认领同款）
            rawConnection: { query: vi.fn().mockResolvedValue([[{ credit }], []]) },
        } as any;
        void delta;
        return { svc: new RiderCreditService(conn), conn, logRepo, saved };
    };

    it('正常完单 +2 → 单条原子 UPDATE 返回新分值（正分用 LEAST 100 封顶）', async () => {
        const { svc, conn, saved } = mk(102, 2);
        const next = await svc.adjust({ channelId: 1 } as any, 9, 2, 'complete', 10 as any);
        expect(next).toBe(102);
        expect(conn.rawConnection.query).toHaveBeenCalledWith(
            expect.stringContaining('LEAST('),
            [2, 9],
        );
        expect(saved[0]).toEqual(expect.objectContaining({ delta: 2, reason: 'complete', orderId: 10 }));
    });

    it('拒单 -5', async () => {
        const { svc, saved } = mk(95, -5);
        const next = await svc.adjust({ channelId: 1 } as any, 9, -5, 'reject_assign');
        expect(next).toBe(95);
        expect(saved[0]).toEqual(expect.objectContaining({ delta: -5 }));
    });

    it('扣到 0 为下限（DB GREATEST 夹紧）', async () => {
        const { svc } = mk(0, -10);
        const next = await svc.adjust({ channelId: 1 } as any, 9, -10, 'timeout_not_picked');
        expect(next).toBe(0);
    });

    it('流水落库失败 → 分数照常返回并告警（不抛错导致调用方重复加减分）', async () => {
        const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined as any);
        const conn = {
            getRepository: vi.fn(() => ({ save: vi.fn().mockRejectedValue(new Error('db down')) })),
            rawConnection: { query: vi.fn().mockResolvedValue([[{ credit: 98 }], []]) },
        } as any;
        const svc = new RiderCreditService(conn);
        await expect(svc.adjust({ channelId: 1 } as any, 9, -2, 'reject_assign')).resolves.toBe(98);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('rider credit log save failed'), 'CampusCredit');
        warn.mockRestore();
    });

    it('UPDATE 未匹配行（顾客不存在）→ 回退值仍夹在 0-100', async () => {
        const conn = {
            getRepository: vi.fn(() => ({ save: vi.fn().mockResolvedValue({}) })),
            rawConnection: { query: vi.fn().mockResolvedValue([[], []]) },
        } as any;
        const svc = new RiderCreditService(conn);
        await expect(svc.adjust({ channelId: 1 } as any, 9, 5, 'recovery_7d_clean')).resolves.toBe(100);
        await expect(svc.adjust({ channelId: 1 } as any, 9, -200, 'timeout_not_picked')).resolves.toBe(0);
    });
});

describe('RiderCreditService.sweepRecovery', () => {
    const mk = (
        candidates: any[],
        opts: { failFor?: number[] } = {},
    ) => {
        const saved: any[] = [];
        const logRepo = { save: vi.fn().mockImplementation(v => { saved.push(v); return Promise.resolve(v); }) };
        const query = vi.fn().mockImplementation((sql: string, params: any[]) => {
            if (String(sql).includes('SELECT DISTINCT c.id')) return Promise.resolve([candidates, []]);
            if (opts.failFor?.includes(params?.[1])) return Promise.reject(new Error('db down'));
            return Promise.resolve([[{ credit: 60 }], []]);
        });
        const conn = { getRepository: vi.fn(() => logRepo), rawConnection: { query } } as any;
        return { svc: new RiderCreditService(conn), query, saved };
    };

    it('候选骑手逐个 +5 并落 recovery_7d_clean 流水', async () => {
        const { svc, saved } = mk([{ id: 7 }, { id: 8 }]);
        await expect(svc.sweepRecovery({ channelId: 3 } as any)).resolves.toBe(2);
        expect(saved.filter(s => s.reason === 'recovery_7d_clean').map(s => s.customerId)).toEqual([7, 8]);
        expect(saved[0]).toEqual(expect.objectContaining({ delta: 5, channelId: 3 }));
    });

    it('候选为空 → 不执行加分，返回 0', async () => {
        const { svc, query } = mk([]);
        await expect(svc.sweepRecovery({ channelId: 3 } as any)).resolves.toBe(0);
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('SQL 用带引号的 camelCase 列名 + 7 天恢复去重（防 PG 折叠报错与每轮重复加分）', async () => {
        const { svc, query } = mk([]);
        await svc.sweepRecovery({ channelId: 3 } as any);
        const sql = String(query.mock.calls[0][0]);
        expect(sql).toContain('SELECT DISTINCT "customerId" FROM rider_credit_log');
        expect(sql).toContain('"channelId" = $1');
        expect(sql).toContain('log."customerId" = c.id');
        expect(sql).toContain("reason = 'recovery_7d_clean'");
        // 时间窗参数 = 7 天前
        const since = query.mock.calls[0][1][1] as Date;
        expect(Date.now() - since.getTime()).toBeGreaterThan(6 * 86_400_000);
        expect(Date.now() - since.getTime()).toBeLessThan(8 * 86_400_000);
    });

    it('单个骑手加分失败 → 跳过并告警，其余继续', async () => {
        const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined as any);
        const { svc, saved } = mk([{ id: 7 }, { id: 8 }], { failFor: [7] });
        await expect(svc.sweepRecovery({ channelId: 3 } as any)).resolves.toBe(1);
        expect(saved.map(s => s.customerId)).toEqual([8]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('credit recovery failed rider=7'), 'CampusCredit');
        warn.mockRestore();
    });
});
