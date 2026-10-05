import { describe, expect, it, vi } from 'vitest';
import { DispatchJobService } from './dispatch-job.service';

function makeEnv(opts: {
    openOrders?: any[];
    assignedOrders?: any[];
    onlineRiders?: any[];
    cfg?: any;
}) {
    const grabResults: any[] = [];
    const grabSvc = {
        grabByRider: vi.fn().mockImplementation((_ctx: any, orderId: any, rider: any) => {
            grabResults.push({ orderId, riderId: rider.id });
            return Promise.resolve({ id: orderId });
        }),
    };
    const creditSvc = { adjust: vi.fn().mockResolvedValue(95) };
    const hallSvc = {
        backToHall: vi.fn().mockResolvedValue({}),
        updateOrder: vi.fn().mockResolvedValue({}),
    };
    const capacitySvc = { listOnlineRiders: vi.fn().mockResolvedValue(opts.onlineRiders ?? []) };
    const orderRepo = {
        findOne: vi.fn(),
        createQueryBuilder: () => ({
            where: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue([...(opts.openOrders ?? []), ...(opts.assignedOrders ?? [])]),
        }),
    };
    const configRepo = { findOne: vi.fn().mockResolvedValue(opts.cfg ?? { autoAssignMinutes: 10, autoRefundMinutes: 30, inProgressSlaMinutes: 45 }) };
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => {
            const name = (ent as any).name;
            if (name === 'CampusFulfillmentConfig') return configRepo;
            return orderRepo;
        }),
    } as any;
    const svc = new DispatchJobService(conn, grabSvc as any, hallSvc as any, capacitySvc as any, creditSvc as any);
    return { svc, grabSvc, creditSvc, hallSvc, capacitySvc, orderRepo, configRepo, grabResults };
}

const now = Date.now();
const minAgo = (m: number) => new Date(now - m * 60_000);

describe('DispatchJobService.scan', () => {
    it('open 超 autoAssignMinutes → 强派最佳在线骑手', async () => {
        const { svc, grabSvc, grabResults } = makeEnv({
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [
                { id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 100 } },
                { id: 8, customFields: { riderOnlineAt: minAgo(1), riderCredit: 90 } },
            ],
        });
        await svc.scan({ channelId: 1 } as any);
        expect(grabResults[0]).toEqual({ orderId: 1, riderId: 7 }); // 信用分高者优先
        expect(grabSvc.grabByRider).toHaveBeenCalledOnce();
    });

    it('低信用分(<60)骑手不参与强派', async () => {
        const { svc, grabResults } = makeEnv({
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [{ id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 59 } }],
        });
        await svc.scan({ channelId: 1 } as any);
        expect(grabResults).toHaveLength(0);
    });

    it('assigned 超 15min 未取货 → 回大厅 + 扣 10 分', async () => {
        const { svc, hallSvc, creditSvc } = makeEnv({
            assignedOrders: [{ id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '9', assignedAt: minAgo(16), hallEnteredAt: minAgo(20) } }],
        });
        await svc.scan({ channelId: 1 } as any);
        expect(hallSvc.backToHall).toHaveBeenCalledWith(expect.anything(), 2);
        expect(creditSvc.adjust).toHaveBeenCalledWith(expect.anything(), 9, -10, 'timeout_not_picked', 2);
    });

    it('assigned 未超 15min 不动', async () => {
        const { svc, hallSvc } = makeEnv({
            assignedOrders: [{ id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '9', assignedAt: minAgo(5), hallEnteredAt: minAgo(6) } }],
        });
        await svc.scan({ channelId: 1 } as any);
        expect(hallSvc.backToHall).not.toHaveBeenCalled();
    });
});
