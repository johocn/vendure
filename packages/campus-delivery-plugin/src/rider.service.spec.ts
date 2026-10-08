// 纯逻辑单测：覆盖 assertApprovedRider 三个断言分支（非骑手/待审拒、低信用分拒）
import { describe, expect, it, vi } from 'vitest';
import { RiderService } from './rider.service';

describe('RiderService.assertApprovedRider', () => {
    const make = (cf: any) => {
        const svc = new RiderService({} as any, {
            findOneByUserId: vi.fn().mockResolvedValue({ id: 1, customFields: cf }),
        } as any);
        return svc.assertApprovedRider({ channelId: 1, activeUserId: 1 } as any);
    };
    it('approved 且信用分达标通过', async () =>
        expect(make({ riderStatus: 'approved', riderCredit: 100 })).resolves.toBeTruthy());
    it('pending 拒绝', async () => expect(make({ riderStatus: 'pending', riderCredit: 100 })).rejects.toThrow());
    it('信用分低于 60 拒绝', async () => expect(make({ riderStatus: 'approved', riderCredit: 59 })).rejects.toThrow());
});

// F8 审核列表分页：skip/take 透传 QueryBuilder，返回 { items, total }
describe('RiderService.listApplications（F8 分页）', () => {
    it('skip/take 透传并返回 items+total', async () => {
        const qb: any = {
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[{ id: 1 }], 1]),
        };
        const conn = {
            getRepository: vi.fn().mockReturnValue({ createQueryBuilder: () => qb }),
        } as any;
        const svc = new RiderService(conn, {} as any);
        const out = await svc.listApplications({ channelId: 1 } as any, 'pending', 50, 25);
        expect(qb.skip).toHaveBeenCalledWith(50);
        expect(qb.take).toHaveBeenCalledWith(25);
        expect(qb.orderBy).toHaveBeenCalled();
        expect(out).toEqual({ items: [{ id: 1 }], total: 1 });
    });

    it('缺省参数：skip=0 / take=200 兜底防全量', async () => {
        const qb: any = {
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        const conn = { getRepository: vi.fn().mockReturnValue({ createQueryBuilder: () => qb }) } as any;
        const svc = new RiderService(conn, {} as any);
        await svc.listApplications({ channelId: 1 } as any, 'approved');
        expect(qb.skip).toHaveBeenCalledWith(0);
        expect(qb.take).toHaveBeenCalledWith(200);
    });

    it('参数钳制：负数 take → 1，超大 take → 500，负 skip → 0', async () => {
        const qb: any = {
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        const conn = { getRepository: vi.fn().mockReturnValue({ createQueryBuilder: () => qb }) } as any;
        const svc = new RiderService(conn, {} as any);
        await svc.listApplications({ channelId: 1 } as any, 'approved', -5, -1);
        expect(qb.skip).toHaveBeenCalledWith(0);
        expect(qb.take).toHaveBeenCalledWith(1);
        await svc.listApplications({ channelId: 1 } as any, 'approved', 0, 100000);
        expect(qb.take).toHaveBeenLastCalledWith(500);
    });
});
