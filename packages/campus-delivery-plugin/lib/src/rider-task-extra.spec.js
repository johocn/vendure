"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rider_task_service_1 = require("./rider-task.service");
function makeEnv(opts = {}) {
    var _a, _b;
    const repoByEntity = {
        Order: { findOne: vitest_1.vi.fn().mockResolvedValue((_a = opts.order) !== null && _a !== void 0 ? _a : null), update: vitest_1.vi.fn().mockResolvedValue({}) },
        Customer: { findOne: vitest_1.vi.fn().mockResolvedValue((_b = opts.rider) !== null && _b !== void 0 ? _b : null) },
    };
    const conn = { getRepository: vitest_1.vi.fn((_ctx, ent) => { var _a; return repoByEntity[(_a = ent.name) !== null && _a !== void 0 ? _a : String(ent)]; }) };
    const svc = new rider_task_service_1.RiderTaskService(conn, { assertApprovedRider: vitest_1.vi.fn().mockResolvedValue({ id: 7 }) }, { adjust: vitest_1.vi.fn() }, { backToHall: vitest_1.vi.fn().mockResolvedValue(undefined) }, { user: vitest_1.vi.fn() });
    return { svc, repoByEntity };
}
(0, vitest_1.describe)('RiderTaskService.orderRider', () => {
    (0, vitest_1.it)('已指派订单返回骑手姓名与信用分（无坐标时 location 为 null）', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'assigned' } },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        (0, vitest_1.expect)(await env.svc.orderRider({}, 5)).toEqual({
            realName: '王同学', credit: 98, location: null,
        });
    });
    (0, vitest_1.it)('未指派/骑手不存在返回 null', async () => {
        const env = makeEnv({ order: { id: 5, customFields: {} } });
        (0, vitest_1.expect)(await env.svc.orderRider({}, 5)).toBeNull();
        const env2 = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '99' } } });
        (0, vitest_1.expect)(await env2.svc.orderRider({}, 5)).toBeNull();
    });
    (0, vitest_1.it)('配送中且有坐标返回 location；delivered 不暴露（隐私）', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress', riderLat: 30.123, riderLng: 120.456 } },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        (0, vitest_1.expect)(await env.svc.orderRider({}, 5)).toEqual({
            realName: '王同学', credit: 98, location: { lat: 30.123, lng: 120.456 },
        });
        const env2 = makeEnv({
            order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered', riderLat: 30.123, riderLng: 120.456 } },
            rider: { id: 7, customFields: { riderRealName: '王同学', riderCredit: 98 } },
        });
        (0, vitest_1.expect)((await env2.svc.orderRider({}, 5)).location).toBeNull();
    });
});
(0, vitest_1.describe)('RiderTaskService.reportLocation', () => {
    (0, vitest_1.it)('配送中本人订单写入 riderLat/riderLng', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' } } });
        await env.svc.reportLocation({}, 5, 30.1, 120.2);
        (0, vitest_1.expect)(env.repoByEntity.Order.update).toHaveBeenCalledWith(5, vitest_1.expect.objectContaining({
            customFields: { riderLat: 30.1, riderLng: 120.2 },
        }));
    });
    (0, vitest_1.it)('非本人订单抛 ForbiddenError', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '99', deliveryStatus: 'in_progress' } } });
        await (0, vitest_1.expect)(env.svc.reportLocation({}, 5, 30.1, 120.2)).rejects.toThrow();
    });
    (0, vitest_1.it)('delivered 状态拒绝上报', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered' } } });
        await (0, vitest_1.expect)(env.svc.reportLocation({}, 5, 30.1, 120.2)).rejects.toThrow('仅配送中的订单可上报位置');
    });
});
(0, vitest_1.describe)('RiderTaskService.urgeOrder', () => {
    const ctx = { activeUserId: 42 };
    (0, vitest_1.it)('配送中订单本人可催单：写 urged=true + urgedAt', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStatus: 'in_progress' }, customer: { user: { id: 42 } } } });
        await env.svc.urgeOrder(ctx, 5);
        (0, vitest_1.expect)(env.repoByEntity.Order.update).toHaveBeenCalledWith(5, vitest_1.expect.objectContaining({
            customFields: vitest_1.expect.objectContaining({ urged: true, urgedAt: vitest_1.expect.any(Date) }),
        }));
    });
    (0, vitest_1.it)('未登录拒绝', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStatus: 'assigned' }, customer: { user: { id: 42 } } } });
        await (0, vitest_1.expect)(env.svc.urgeOrder({}, 5)).rejects.toThrow();
    });
    (0, vitest_1.it)('非下单人拒绝', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStatus: 'assigned' }, customer: { user: { id: 99 } } } });
        await (0, vitest_1.expect)(env.svc.urgeOrder(ctx, 5)).rejects.toThrow();
    });
    (0, vitest_1.it)('不在配送流程（无 deliveryStatus）拒绝', async () => {
        const env = makeEnv({ order: { id: 5, customFields: {}, customer: { user: { id: 42 } } } });
        await (0, vitest_1.expect)(env.svc.urgeOrder(ctx, 5)).rejects.toThrow('订单不存在或不在配送流程中');
    });
    (0, vitest_1.it)('delivered 状态拒绝催单', async () => {
        const env = makeEnv({ order: { id: 5, customFields: { deliveryStatus: 'delivered' }, customer: { user: { id: 42 } } } });
        await (0, vitest_1.expect)(env.svc.urgeOrder(ctx, 5)).rejects.toThrow('当前状态无需催单');
    });
    (0, vitest_1.it)('10min 内重复催单拒绝', async () => {
        const env = makeEnv({
            order: { id: 5, customFields: { deliveryStatus: 'assigned', urgedAt: new Date(Date.now() - 5 * 60 * 1000) }, customer: { user: { id: 42 } } },
        });
        await (0, vitest_1.expect)(env.svc.urgeOrder(ctx, 5)).rejects.toThrow('已收到催单，请耐心等待');
    });
});
(0, vitest_1.describe)('RiderTaskService.transfer', () => {
    function makeTransferEnv(opts = {}) {
        var _a;
        const orderRepo = {
            findOne: vitest_1.vi.fn().mockResolvedValue((_a = opts.order) !== null && _a !== void 0 ? _a : null),
            update: vitest_1.vi.fn().mockResolvedValue({}),
        };
        const conn = { getRepository: vitest_1.vi.fn(() => orderRepo) };
        const hall = { backToHall: vitest_1.vi.fn().mockResolvedValue(undefined) };
        const svc = new rider_task_service_1.RiderTaskService(conn, { assertApprovedRider: vitest_1.vi.fn().mockResolvedValue({ id: 7 }) }, { adjust: vitest_1.vi.fn() }, hall, { user: vitest_1.vi.fn() });
        return { svc, orderRepo, hall };
    }
    (0, vitest_1.it)('assigned 未取货转单：回大厅并清除位置残留，不写交接存证', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'assigned' } } });
        await env.svc.transfer({}, 5, []);
        (0, vitest_1.expect)(env.hall.backToHall).toHaveBeenCalledWith(vitest_1.expect.anything(), 5);
        // plan 2.2 隐私：转单清位置
        (0, vitest_1.expect)(env.orderRepo.update).toHaveBeenCalledWith(5, vitest_1.expect.objectContaining({
            customFields: { riderLat: null, riderLng: null },
        }));
    });
    (0, vitest_1.it)('in_progress 已取货转单：photos 必填并写存证', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'in_progress' } } });
        await (0, vitest_1.expect)(env.svc.transfer({}, 5, [])).rejects.toThrow('已取货转单需拍照交接');
        await env.svc.transfer({}, 5, ['/static/p1.jpg'], '货物完好');
        (0, vitest_1.expect)(env.hall.backToHall).toHaveBeenCalled();
        (0, vitest_1.expect)(env.orderRepo.update).toHaveBeenCalledWith(5, vitest_1.expect.objectContaining({
            customFields: vitest_1.expect.objectContaining({
                transferPhotos: ['/static/p1.jpg'],
                transferNote: '货物完好',
                transferAt: vitest_1.expect.any(Date),
            }),
        }));
    });
    (0, vitest_1.it)('delivered 状态拒绝转单', async () => {
        const env = makeTransferEnv({ order: { id: 5, customFields: { deliveryStaffId: '7', deliveryStatus: 'delivered' } } });
        await (0, vitest_1.expect)(env.svc.transfer({}, 5, [])).rejects.toThrow('当前状态不允许转单');
    });
});
//# sourceMappingURL=rider-task-extra.spec.js.map