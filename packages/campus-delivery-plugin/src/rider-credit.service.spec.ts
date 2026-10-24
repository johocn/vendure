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
});
