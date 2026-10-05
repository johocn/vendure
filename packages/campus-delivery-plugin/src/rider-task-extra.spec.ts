import { describe, expect, it, vi } from 'vitest';
import { RiderTaskService } from './rider-task.service';

function makeEnv(opts: { order?: any; rider?: any } = {}) {
    const repoByEntity: Record<string, any> = {
        Order: { findOne: vi.fn().mockResolvedValue(opts.order ?? null), update: vi.fn().mockResolvedValue({}) },
        Customer: { findOne: vi.fn().mockResolvedValue(opts.rider ?? null) },
    };
    const conn = { getRepository: vi.fn((_ctx: any, ent: any) => repoByEntity[ent.name ?? String(ent)]) } as any;
    const svc = new RiderTaskService(
        conn,
        { assertApprovedRider: vi.fn().mockResolvedValue({ id: 7 }) } as any,
        { adjust: vi.fn() } as any,
        { backToHall: vi.fn().mockResolvedValue(undefined) } as any,
    );
    return { svc, repoByEntity };
}

describe('RiderTaskService.orderRider', () => {
    it('已指派订单返回骑手姓名与信用分', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7' } },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        expect(await env.svc.orderRider({} as any, 5)).toEqual({ realName: '王同学', credit: 98 });
    });
    it('未指派/骑手不存在返回 null', async () => {
        const env = makeEnv({ order: { id: 5, customFields: {} } });
        expect(await env.svc.orderRider({} as any, 5)).toBeNull();
        const env2 = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '99' } } });
        expect(await env2.svc.orderRider({} as any, 5)).toBeNull();
    });
});
