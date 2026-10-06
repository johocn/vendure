// 纯逻辑单测：grab 事务防双抢（open 可抢 / 已被抢抛「手慢了」/ 不能抢自己的订单）
import { describe, expect, it, vi } from 'vitest';
import { HallGrabService } from './hall-grab.service';

const openOrder = { id: 10, code: 'A1', customer: { id: 7 }, customFields: { hallStatus: 'open' } };

function makeSvc(order: any) {
    const riderSvc = {
        assertApprovedRider: vi.fn().mockResolvedValue({
            id: 9,
            customFields: { riderStatus: 'approved', riderCredit: 100 },
        }),
    } as any;
    const updated: any[] = [];
    const em = {
        getRepository: () => ({
            findOne: vi.fn().mockResolvedValue(order),
            update: vi.fn((_id: any, patch: any) => {
                updated.push(patch);
                return Promise.resolve();
            }),
            findOneByOrFail: vi.fn().mockResolvedValue(order),
        }),
    };
    const conn = { rawConnection: { transaction: (fn: any) => fn(em) } } as any;
    return { svc: new HallGrabService(conn, riderSvc, { user: vi.fn() } as any), updated };
}

describe('HallGrabService.grab', () => {
    it('open 订单可抢并写入 delivery customFields', async () => {
        const { svc, updated } = makeSvc(openOrder);
        await svc.grab({ channelId: 1 } as any, 10 as any);
        expect(updated[0].customFields.hallStatus).toBe('grabbed');
        expect(updated[0].customFields.deliveryStatus).toBe('assigned');
        expect(updated[0].customFields.deliveryStaffId).toBe('9');
    });
    it('已被抢订单抛「手慢了」', async () => {
        const grabbed = { ...openOrder, customFields: { hallStatus: 'grabbed' } };
        const { svc } = makeSvc(grabbed);
        await expect(svc.grab({ channelId: 1 } as any, 10 as any)).rejects.toThrow('手慢了');
    });
    it('不能抢自己的订单', async () => {
        const mine = { ...openOrder, customer: { id: 9 } };
        const { svc } = makeSvc(mine);
        await expect(svc.grab({ channelId: 1 } as any, 10 as any)).rejects.toThrow('不能抢自己的订单');
    });
});
