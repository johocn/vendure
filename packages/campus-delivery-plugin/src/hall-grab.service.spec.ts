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

// plan 3.3 多单顺路：整组抢单（主单带 routeGroupId → 同组 open 单一并写同一骑手）
describe('HallGrabService.grab 整组抢单（plan 3.3）', () => {
    function makeGroupSvc(main: any, mates: any[]) {
        const riderSvc = {
            assertApprovedRider: vi.fn().mockResolvedValue({ id: 9 }),
        } as any;
        const updates: Array<{ id: any; riderId: string }> = [];
        const notifyCalls: any[] = [];
        const em = {
            getRepository: () => ({
                findOne: vi.fn().mockResolvedValue(main),
                findOneByOrFail: vi.fn().mockResolvedValue(main),
                update: vi.fn((id: any, patch: any) => {
                    updates.push({ id, riderId: patch.customFields.deliveryStaffId });
                    return Promise.resolve();
                }),
                createQueryBuilder: () => ({
                    where: vi.fn().mockReturnThis(),
                    andWhere: vi.fn().mockReturnThis(),
                    orderBy: vi.fn().mockReturnThis(),
                    setLock: vi.fn().mockReturnThis(),
                    getMany: vi.fn().mockResolvedValue(mates),
                }),
            }),
        };
        const conn = { rawConnection: { transaction: (fn: any) => fn(em) } } as any;
        const svc = new HallGrabService(conn, riderSvc, { user: vi.fn((_c: any, id: any) => notifyCalls.push(id)) } as any);
        return { svc, updates, notifyCalls };
    }

    it('整组接走：组内 open 单全部写同一骑手并逐单通知', async () => {
        const main = { id: 10, code: 'A1', customer: { id: 7 }, customerId: 7, customFields: { hallStatus: 'open', routeGroupId: 'rg-x' } };
        const { svc, updates, notifyCalls } = makeGroupSvc(main, [
            { id: 11, customerId: 8, customFields: { hallStatus: 'open', routeGroupId: 'rg-x' } },
            { id: 12, customerId: 50, customFields: { hallStatus: 'grabbed', routeGroupId: 'rg-x' } }, // 已被抢，getMany 过滤由 SQL 完成，mock 模拟返回前由 hallStatus 过滤
        ].filter(m => m.customFields.hallStatus === 'open'));
        await svc.grab({ channelId: 1 } as any, 10 as any);
        expect(updates.map(u => u.id).sort()).toEqual([10, 11]);
        expect(new Set(updates.map(u => u.riderId))).toEqual(new Set(['9']));
        expect(notifyCalls.sort()).toEqual([10, 11]);
    });

    it('组内骑手自己的单跳过留在大厅', async () => {
        const main = { id: 10, code: 'A1', customer: { id: 7 }, customFields: { hallStatus: 'open', routeGroupId: 'rg-x' } };
        const { svc, updates } = makeGroupSvc(main, [
            { id: 12, customerId: 9, customFields: { hallStatus: 'open', routeGroupId: 'rg-x' } }, // 骑手自己(9)的单
        ]);
        await svc.grab({ channelId: 1 } as any, 10 as any);
        expect(updates.map(u => u.id)).toEqual([10]);
    });

    it('无 routeGroupId 的单行为不变（单卡抢单）', async () => {
        const { svc, updates, notifyCalls } = makeGroupSvc(openOrder, []);
        await svc.grab({ channelId: 1 } as any, 10 as any);
        expect(updates).toHaveLength(1);
        expect(updates[0].id).toBe(10);
        expect(notifyCalls).toEqual([10]);
    });
});
