// 纯逻辑单测：在线骑手 = approved 且 5min 内有心跳；T0 预检透出 paused + 在线数
import { describe, expect, it, vi } from 'vitest';
import { CapacityService } from './capacity.service';

const fiveMin = 5 * 60 * 1000;

describe('CapacityService', () => {
    const mk = (customers: any[], cfg: any = { paused: false }) => {
        const customerRepo = { createQueryBuilder: () => ({
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue(customers),
        }) };
        const configRepo = { findOne: vi.fn().mockResolvedValue(cfg) };
        const conn = { getRepository: vi.fn((_ctx: any, ent: any) =>
            (ent as any).name === 'CampusFulfillmentConfig' ? configRepo : customerRepo) } as any;
        const riderService = { assertApprovedRider: vi.fn().mockResolvedValue({ id: 9 }) } as any;
        return { svc: new CapacityService(conn, riderService), customerRepo, configRepo, riderService };
    };

    it('在线 = approved 且心跳在 5min 内', async () => {
        const { svc } = mk([
            { id: 1, customFields: { riderStatus: 'approved', riderOnlineAt: new Date(Date.now() - 60_000) } },
            { id: 2, customFields: { riderStatus: 'approved', riderOnlineAt: new Date(Date.now() - fiveMin - 1000) } },
            { id: 3, customFields: { riderStatus: 'suspended', riderOnlineAt: new Date() } },
        ]);
        const riders = await svc.listOnlineRiders({ channelId: 1 } as any);
        expect(riders.map((r: any) => r.id)).toEqual([1]);
    });

    it('capacityCheck：0 骑手时 ridersOnline=0 且 paused 透出', async () => {
        const { svc } = mk([], { paused: true });
        const out = await svc.capacityCheck({ channelId: 1 } as any);
        expect(out).toEqual({ paused: true, ridersOnline: 0 });
    });
});
