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
        { user: vi.fn() } as any,
    );
    return { svc, repoByEntity };
}

describe('RiderTaskService.orderRider', () => {
    it('已指派订单返回骑手姓名与信用分（无坐标时 location 为 null）', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'assigned' } },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        expect(await env.svc.orderRider({} as any, 5)).toEqual({
            realName: '王同学', credit: 98, location: null,
        });
    });
    it('未指派/骑手不存在返回 null', async () => {
        const env = makeEnv({ order: { id: 5, customFields: {} } });
        expect(await env.svc.orderRider({} as any, 5)).toBeNull();
        const env2 = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '99' } } });
        expect(await env2.svc.orderRider({} as any, 5)).toBeNull();
    });
    it('配送中且有坐标返回 location；delivered 不暴露（隐私）', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress', riderLat: 30.123, riderLng: 120.456 } },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        expect(await env.svc.orderRider({} as any, 5)).toEqual({
            realName: '王同学', credit: 98, location: { lat: 30.123, lng: 120.456 },
        });
        const env2 = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered', riderLat: 30.123, riderLng: 120.456 } },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        expect((await env2.svc.orderRider({} as any, 5))!.location).toBeNull();
    });
});

describe('RiderTaskService.reportLocation', () => {
    it('配送中本人订单写入 riderLat/riderLng', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' } } });
        await env.svc.reportLocation({} as any, 5, 30.1, 120.2);
        expect(env.repoByEntity.Order.update).toHaveBeenCalledWith(5, expect.objectContaining({
            customFields: { riderLat: 30.1, riderLng: 120.2 },
        }));
    });
    it('非本人订单抛 ForbiddenError', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '99', deliveryStatus: 'in_progress' } } });
        await expect(env.svc.reportLocation({} as any, 5, 30.1, 120.2)).rejects.toThrow();
    });
    it('delivered 状态拒绝上报', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered' } } });
        await expect(env.svc.reportLocation({} as any, 5, 30.1, 120.2)).rejects.toThrow('仅配送中的订单可上报位置');
    });
});

describe('RiderTaskService.transfer', () => {
    function makeTransferEnv(opts: { order?: any } = {}) {
        const orderRepo = {
            findOne: vi.fn().mockResolvedValue(opts.order ?? null),
            update: vi.fn().mockResolvedValue({}),
        };
        const conn = { getRepository: vi.fn(() => orderRepo) } as any;
        const hall = { backToHall: vi.fn().mockResolvedValue(undefined) };
        const svc = new RiderTaskService(
            conn,
            { assertApprovedRider: vi.fn().mockResolvedValue({ id: 7 }) } as any,
            { adjust: vi.fn() } as any,
            hall as any,
            { user: vi.fn() } as any,
        );
        return { svc, orderRepo, hall };
    }

    it('assigned 未取货转单：回大厅并清除位置残留，不写交接存证', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'assigned' } } });
        await env.svc.transfer({} as any, 5, []);
        expect(env.hall.backToHall).toHaveBeenCalledWith(expect.anything(), 5);
        // plan 2.2 隐私：转单清位置
        expect(env.orderRepo.update).toHaveBeenCalledWith(5, expect.objectContaining({
            customFields: { riderLat: null, riderLng: null },
        }));
    });

    it('in_progress 已取货转单：photos 必填并写存证', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' } } });
        await expect(env.svc.transfer({} as any, 5, [])).rejects.toThrow('已取货转单需拍照交接');
        await env.svc.transfer({} as any, 5, ['/static/p1.jpg'], '货物完好');
        expect(env.hall.backToHall).toHaveBeenCalled();
        expect(env.orderRepo.update).toHaveBeenCalledWith(5, expect.objectContaining({
            customFields: expect.objectContaining({
                transferPhotos: ['/static/p1.jpg'],
                transferNote: '货物完好',
                transferAt: expect.any(Date),
            }),
        }));
    });

    it('delivered 状态拒绝转单', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered' } } });
        await expect(env.svc.transfer({} as any, 5, [])).rejects.toThrow('当前状态不允许转单');
    });
});
