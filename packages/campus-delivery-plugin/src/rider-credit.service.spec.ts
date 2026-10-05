// 纯逻辑单测：加减分（+2 完单 / -5 拒单 / 扣到 0 下限）+ 流水落库
import { describe, expect, it, vi } from 'vitest';
import { RiderCreditService } from './rider-credit.service';

describe('RiderCreditService.adjust', () => {
    const mk = (credit: number) => {
        const saved: any[] = [];
        const customerRepo = {
            update: vi.fn().mockResolvedValue({}),
        };
        const logRepo = { save: vi.fn().mockImplementation(v => { saved.push(v); return Promise.resolve(v); }) };
        const conn = { getRepository: vi.fn((_ctx: any, ent: any) =>
            (ent as any).name === 'RiderCreditLog' ? logRepo : customerRepo) } as any;
        // findOne 返回带 customFields 的 customer（模拟连接池直读）
        (conn as any).rawConnection = { transaction: (fn: any) => fn({
            getRepository: () => ({ findOne: vi.fn().mockResolvedValue({ id: 9, customFields: { riderCredit: credit } }) }),
        }) };
        return { svc: new RiderCreditService(conn), customerRepo, logRepo, saved };
    };

    it('正常完单 +2', async () => {
        const { svc, customerRepo, saved } = mk(100);
        await svc.adjust({ channelId: 1 } as any, 9, 2, 'complete', 10 as any);
        expect(customerRepo.update).toHaveBeenCalledWith(9, expect.objectContaining({
            customFields: { riderCredit: 102 },
        }));
        expect(saved[0]).toEqual(expect.objectContaining({ delta: 2, reason: 'complete', orderId: 10 }));
    });

    it('拒单 -5', async () => {
        const { svc, customerRepo } = mk(100);
        await svc.adjust({ channelId: 1 } as any, 9, -5, 'reject_assign');
        expect(customerRepo.update).toHaveBeenCalledWith(9, expect.objectContaining({
            customFields: { riderCredit: 95 },
        }));
    });

    it('扣到 0 为下限', async () => {
        const { svc, customerRepo } = mk(3);
        await svc.adjust({ channelId: 1 } as any, 9, -10, 'timeout_not_picked');
        expect(customerRepo.update).toHaveBeenCalledWith(9, expect.objectContaining({
            customFields: { riderCredit: 0 },
        }));
    });
});
