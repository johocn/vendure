import { describe, expect, it, vi } from 'vitest';
import { RiderTaskService } from './rider-task.service';

function makeEnv(opts: { order?: any; rider?: any; building?: any } = {}) {
    const repoByEntity: Record<string, any> = {
        Order: { findOne: vi.fn().mockResolvedValue(opts.order ?? null), update: vi.fn().mockResolvedValue({}) },
        Customer: { findOne: vi.fn().mockResolvedValue(opts.rider ?? null) },
        CampusBuilding: { findOne: vi.fn().mockResolvedValue(opts.building ?? null) },
    };
    // 位置上报/送达均走条件写（RETURNING id）：默认命中 1 行
    const rawQuery = vi.fn().mockResolvedValue([[{ id: 5 }], []]);
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => repoByEntity[ent.name ?? String(ent)]),
        rawConnection: { query: rawQuery },
    } as any;
    const svc = new RiderTaskService(
        conn,
        { assertApprovedRider: vi.fn().mockResolvedValue({ id: 7 }) } as any,
        { adjust: vi.fn() } as any,
        { backToHall: vi.fn().mockResolvedValue(undefined) } as any,
        { user: vi.fn() } as any,
        {} as any, // privacy
        {} as any, // feishu
    );
    return { svc, repoByEntity, rawQuery };
}

describe('RiderTaskService.orderRider', () => {
    const ctx = { activeUserId: 42 } as any;
    const owner = { user: { id: 42 } };
    it('已指派订单返回骑手姓名与信用分（无坐标时 location/destination 为 null）', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'assigned' }, customer: owner },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        expect(await env.svc.orderRider(ctx, 5)).toEqual({
            realName: '王同学',
            credit: 98,
            location: null,
            destination: null,
            distanceMeters: null,
            etaMinutes: null,
            deliveryStatus: 'assigned',
            phone: null,
        });
    });
    it('未指派/骑手不存在返回 null', async () => {
        const env = makeEnv({ order: { id: 5, customFields: {}, customer: owner } });
        expect(await env.svc.orderRider(ctx, 5)).toBeNull();
        const env2 = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '99' }, customer: owner } });
        expect(await env2.svc.orderRider(ctx, 5)).toBeNull();
    });
    it('配送中且有坐标返回 location；delivered 不暴露（隐私）', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress', riderLat: 30.123, riderLng: 120.456 }, customer: owner },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        const r = await env.svc.orderRider(ctx, 5);
        expect(r).toEqual({
            realName: '王同学',
            credit: 98,
            location: { lat: 30.123, lng: 120.456 },
            destination: null,
            distanceMeters: null,
            etaMinutes: null,
            deliveryStatus: 'in_progress',
            phone: null,
        });
        const env2 = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered', riderLat: 30.123, riderLng: 120.456 }, customer: owner },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        expect((await env2.svc.orderRider(ctx, 5))!.location).toBeNull();
    });
    it('楼栋有坐标时返回 destination 与直线距离/ETA；无坐标楼栋降级为 null', async () => {
        // 骑手 (30.1,120.2) 与楼栋 (30.109,120.2) 纬度相差约 0.009° ≈ 1000m → ETA ≈ 4 分钟
        const env = makeEnv({
            order: {
                id: 5,
                customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress', riderLat: 30.1, riderLng: 120.2, buildingId: '3' },
                customer: owner,
            },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
            building: { id: 3, name: '桂3栋', detail: '东单元', lat: 30.109, lng: 120.2 },
        });
        const r = await env.svc.orderRider(ctx, 5);
        expect(r!.destination).toEqual({ name: '桂3栋', detail: '东单元', lat: 30.109, lng: 120.2 });
        expect(r!.distanceMeters).toBeGreaterThan(990);
        expect(r!.distanceMeters).toBeLessThan(1010);
        expect(r!.etaMinutes).toBe(4);

        const env2 = makeEnv({
            order: {
                id: 5,
                customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress', riderLat: 30.1, riderLng: 120.2, buildingId: '3' },
                customer: owner,
            },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
            building: { id: 3, name: '桂3栋', detail: null, lat: null, lng: null },
        });
        expect((await env2.svc.orderRider(ctx, 5))!.destination).toBeNull();
        expect((await env2.svc.orderRider(ctx, 5))!.distanceMeters).toBeNull();
    });
    it('非下单人读取抛 ForbiddenError（未登录同样拒绝）', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' }, customer: { user: { id: 99 } } },
            rider: { id: 7, customFields: {} },
        });
        await expect(env.svc.orderRider(ctx, 5)).rejects.toThrow();
        await expect(env.svc.orderRider({} as any, 5)).rejects.toThrow();
    });
});

describe('RiderTaskService.reportLocation', () => {
    it('配送中本人订单按条件写落 riderLat/riderLng，并留痕轨迹（5s 内去重）', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' } } });
        await env.svc.reportLocation({ channelId: 2 } as any, 5, 30.1, 120.2);
        expect(env.rawQuery).toHaveBeenCalledTimes(2);
        const [sql, params] = env.rawQuery.mock.calls[0];
        expect(sql).toContain('"customFieldsRiderlat"');
        expect(sql).toContain('"customFieldsDeliverystaffid"');
        expect(sql).toContain('"state" <> \'Cancelled\'');
        expect(params).toEqual([30.1, 120.2, 5, '7', ['assigned', 'in_progress']]);
        const [trackSql, trackParams] = env.rawQuery.mock.calls[1];
        expect(trackSql).toContain('INSERT INTO campus_rider_location');
        expect(trackSql).toContain('interval \'5 seconds\'');
        expect(trackParams).toEqual([2, 5, 7, 30.1, 120.2]);
        expect(env.repoByEntity.Order.update).not.toHaveBeenCalled();
    });
    it('轨迹留痕失败不影响实时位置上报', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' } } });
        env.rawQuery
            .mockResolvedValueOnce([[{ id: 5 }], []])
            .mockRejectedValueOnce(new Error('relation "campus_rider_location" does not exist'));
        await expect(env.svc.reportLocation({} as any, 5, 30.1, 120.2)).resolves.toBeTruthy();
    });
    it('坐标非法直接拒绝（不查库）', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' } } });
        await expect(env.svc.reportLocation({} as any, 5, NaN, 120.2)).rejects.toThrow('位置坐标不合法');
        await expect(env.svc.reportLocation({} as any, 5, 30.1, 181)).rejects.toThrow('位置坐标不合法');
        expect(env.rawQuery).not.toHaveBeenCalled();
    });
    it('非本人订单抛 ForbiddenError', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '99', deliveryStatus: 'in_progress' } } });
        await expect(env.svc.reportLocation({} as any, 5, 30.1, 120.2)).rejects.toThrow();
    });
    it('已送达/已取消（条件写未命中）→ 拒绝上报', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered' } } });
        env.rawQuery.mockResolvedValueOnce([[], []]);
        await expect(env.svc.reportLocation({} as any, 5, 30.1, 120.2)).rejects.toThrow('订单已被取消或改派');
    });
});

describe('RiderTaskService.urgeOrder', () => {
    const ctx = { activeUserId: 42 } as any;
    it('配送中订单本人可催单：写 urged=true + urgedAt', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStatus: 'in_progress' }, customer: { user: { id: 42 } } } });
        await env.svc.urgeOrder(ctx, 5);
        expect(env.repoByEntity.Order.update).toHaveBeenCalledWith(5, expect.objectContaining({
            customFields: expect.objectContaining({ urged: true, urgedAt: expect.any(Date) }),
        }));
    });
    it('未登录拒绝', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStatus: 'assigned' }, customer: { user: { id: 42 } } } });
        await expect(env.svc.urgeOrder({} as any, 5)).rejects.toThrow();
    });
    it('非下单人拒绝', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStatus: 'assigned' }, customer: { user: { id: 99 } } } });
        await expect(env.svc.urgeOrder(ctx, 5)).rejects.toThrow();
    });
    it('不在配送流程（无 deliveryStatus）拒绝', async () => {
        const env = makeEnv({ order: { id: 5, customFields: {}, customer: { user: { id: 42 } } } });
        await expect(env.svc.urgeOrder(ctx, 5)).rejects.toThrow('订单不存在或不在配送流程中');
    });
    it('delivered 状态拒绝催单', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStatus: 'delivered' }, customer: { user: { id: 42 } } } });
        await expect(env.svc.urgeOrder(ctx, 5)).rejects.toThrow('当前状态无需催单');
    });
    it('10min 内重复催单拒绝', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStatus: 'assigned', urgedAt: new Date(Date.now() - 5 * 60 * 1000) }, customer: { user: { id: 42 } } },
        });
        await expect(env.svc.urgeOrder(ctx, 5)).rejects.toThrow('已收到催单，请耐心等待');
    });
});

describe('RiderTaskService.transfer', () => {
    function makeTransferEnv(opts: { order?: any } = {}) {
        const orderRepo = {
            findOne: vi.fn().mockResolvedValue(opts.order ?? null),
            update: vi.fn().mockResolvedValue({}),
        };
        const conn = { getRepository: vi.fn(() => orderRepo) } as any;
        const hall = { backToHall: vi.fn().mockResolvedValue(true) };
        const svc = new RiderTaskService(
            conn,
            { assertApprovedRider: vi.fn().mockResolvedValue({ id: 7 }) } as any,
            { adjust: vi.fn() } as any,
            hall as any,
            { user: vi.fn() } as any,
            {} as any, // privacy
            {} as any, // feishu
        );
        return { svc, orderRepo, hall };
    }

    it('assigned 未取货转单：回大厅并清除位置残留，不写交接存证', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'assigned' } } });
        await env.svc.transfer({} as any, 5, []);
        // 位置残留与回厅字段同一条 CAS 语句写入（不再二次 update，避免半更新）
        expect(env.hall.backToHall).toHaveBeenCalledWith(expect.anything(), 5, { riderLat: null, riderLng: null });
        expect(env.orderRepo.update).not.toHaveBeenCalled();
    });

    it('in_progress 已取货转单：photos 必填并写存证', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' } } });
        await expect(env.svc.transfer({} as any, 5, [])).rejects.toThrow('已取货转单需拍照交接');
        await env.svc.transfer({} as any, 5, ['/static/p1.jpg'], '货物完好');
        expect(env.hall.backToHall).toHaveBeenCalledWith(expect.anything(), 5, expect.objectContaining({
            riderLat: null,
            riderLng: null,
            // simple-array 物理列：原生 SQL 按逗号分隔写入
            transferPhotos: '/static/p1.jpg',
            transferNote: '货物完好',
            transferAt: expect.any(Date),
        }));
        expect(env.orderRepo.update).not.toHaveBeenCalled();
    });

    it('delivered 状态拒绝转单', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered' } } });
        await expect(env.svc.transfer({} as any, 5, [])).rejects.toThrow('当前状态不允许转单');
    });

    it('订单已被取消/改派（条件回厅不命中）→ 拒绝转单，不复活订单', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'assigned' } } });
        env.hall.backToHall.mockResolvedValueOnce(false);
        await expect(env.svc.transfer({} as any, 5, [])).rejects.toThrow('订单已被取消或改派');
        // 只有那一次被拒的 CAS 写；不得再补写位置/存证
        expect(env.hall.backToHall).toHaveBeenCalledTimes(1);
        expect(env.orderRepo.update).not.toHaveBeenCalled();
    });
});
