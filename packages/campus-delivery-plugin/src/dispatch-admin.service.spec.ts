import { describe, expect, it, vi } from 'vitest';
import { DispatchAdminService } from './dispatch-admin.service';

function makeEnv(opts: { orders?: any[]; onlineRiders?: any[]; cfg?: any }) {
    const grabSvc = { grabByRider: vi.fn().mockResolvedValue(true) };
    const hallSvc = { backToHall: vi.fn().mockResolvedValue({}) };
    const capacitySvc = { listOnlineRiders: vi.fn().mockResolvedValue(opts.onlineRiders ?? []) };
    const orderRepo = {
        findOne: vi.fn(),
        createQueryBuilder: () => ({
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue(opts.orders ?? []),
        }),
    };
    const configRepo = {
        findOne: vi.fn().mockResolvedValue(opts.cfg ?? { autoAssignMinutes: 10, inProgressSlaMinutes: 45 }),
    };
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => {
            const name = (ent as any).name;
            if (name === 'CampusFulfillmentConfig') return configRepo;
            return orderRepo;
        }),
    } as any;
    const svc = new DispatchAdminService(conn, grabSvc as any, hallSvc as any, capacitySvc as any);
    return { svc, grabSvc, hallSvc, capacitySvc, orderRepo, configRepo };
}

const now = Date.now();
const minAgo = (m: number) => new Date(now - m * 60_000);

describe('DispatchAdminService.board', () => {
    it('滞留超 autoAssignMinutes 的 open 单 → alert stale_open', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(12), campusZone: 'A区' } }],
            cfg: { autoAssignMinutes: 10, inProgressSlaMinutes: 45 },
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.alerts[0]).toEqual(expect.objectContaining({ orderId: '1', type: 'stale_open' }));
    });

    it('open 未超时 → 不告警，进 hallOrders', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(3) } }],
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.alerts).toHaveLength(0);
        expect(board.hallOrders).toHaveLength(1);
        expect(board.activeOrders).toHaveLength(0);
    });

    it('in_progress 超 SLA → alert sla_breach', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 2, code: 'A2', customFields: { hallStatus: 'grabbed', deliveryStatus: 'in_progress', assignedAt: minAgo(50) } }],
            cfg: { inProgressSlaMinutes: 45 },
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.alerts[0]).toEqual(expect.objectContaining({ orderId: '2', type: 'sla_breach' }));
        expect(board.activeOrders).toHaveLength(1);
    });

    it('campusCause=slot_full → alert slot_full', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 3, code: 'A3', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(1), campusCause: 'slot_full' } }],
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.alerts[0]).toEqual(expect.objectContaining({ orderId: '3', type: 'slot_full' }));
    });
});
