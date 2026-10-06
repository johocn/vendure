// 纯逻辑单测：状态机（assigned 可开始 / 状态不符拒）、分成计算（100% 与 80%）、照片必传、非本骑手拒
import { describe, expect, it, vi } from 'vitest';
import { RiderTaskService } from './rider-task.service';

function make(order: any, cfg: any = { riderCommissionRate: 100 }) {
    const riderSvc = { assertApprovedRider: vi.fn().mockResolvedValue({ id: 9 }) } as any;
    const saved: any[] = [];
    // findOne 调用次序：deliver = assertOwner(查单) → getConfig(查配置)；start = assertOwner(查单)
    const repo = {
        findOne: vi.fn().mockImplementation((opts: any) =>
            opts?.where?.channelId !== undefined ? Promise.resolve(cfg) : Promise.resolve(order)),
        update: vi.fn().mockResolvedValue({}),
        save: vi.fn().mockImplementation((v: any) => {
            saved.push(v);
            return Promise.resolve(v);
        }),
    };
    const conn = { getRepository: () => repo } as any;
    return { svc: new RiderTaskService(conn, riderSvc, { adjust: vi.fn().mockResolvedValue(102) } as any, { backToHall: vi.fn() } as any), repo, saved };
}

const assigned = { id: 10, code: 'A1', shipping: 300, customFields: { deliveryStaffId: '9', deliveryStatus: 'assigned', tip: 100 } };

describe('RiderTaskService', () => {
    it('assigned 可开始配送', async () => {
        const { svc, repo } = make(assigned);
        await svc.start({ channelId: 1 } as any, 10 as any);
        expect(repo.update).toHaveBeenCalledWith(10, expect.objectContaining({ customFields: { deliveryStatus: 'in_progress' } }));
    });
    it('delivered 需照片且分成=配送费+小费', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, repo, saved } = make(inProg, { riderCommissionRate: 100 });
        await svc.deliver({ channelId: 1 } as any, 10 as any, ['p1']);
        expect(repo.update).toHaveBeenCalled();
        expect(saved[0].amount).toBe(400); // 300 shipping + 100 tip
    });
    it('分成比例 80%', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, saved } = make(inProg, { riderCommissionRate: 80 });
        await svc.deliver({ channelId: 1 } as any, 10 as any, ['p1']);
        expect(saved[0].amount).toBe(320);
    });
    it('无照片拒单', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc } = make(inProg);
        await expect(svc.deliver({ channelId: 1 } as any, 10 as any, [])).rejects.toThrow('送达需至少一张照片');
    });
    it('非本骑手拒', async () => {
        const other = { ...assigned, customFields: { deliveryStaffId: '8', deliveryStatus: 'assigned' } };
        const { svc } = make(other);
        await expect(svc.start({ channelId: 1 } as any, 10 as any)).rejects.toThrow();
    });
    it('0 分成单（0 运费 0 小费）不入账不写 earning 且不抛错', async () => {
        const zero = { id: 11, code: 'A2', shipping: 0, customFields: { deliveryStaffId: '9', deliveryStatus: 'in_progress', tip: 0 } };
        const { svc, saved } = make(zero, { riderCommissionRate: 80 });
        const order = await svc.deliver({ channelId: 1 } as any, 11 as any, ['p1']);
        expect(order).toBeTruthy();
        expect(saved).toHaveLength(0); // 未写 RiderEarning
    });
    it('有运费但分成 0（rate=0）仍写 earning 走入账分支', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, saved } = make(inProg, { riderCommissionRate: 0 });
        await svc.deliver({ channelId: 1 } as any, 10 as any, ['p1']);
        expect(saved).toHaveLength(1);
        expect(saved[0].amount).toBe(0);
    });
});
