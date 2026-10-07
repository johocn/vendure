"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 预约单入厅闸门 + 放量单测（plan 3.1）
const vitest_1 = require("vitest");
const hall_service_1 = require("./hall.service");
function makeEnv(opts = {}) {
    var _a, _b;
    const updates = [];
    const orderRepo = {
        update: vitest_1.vi.fn().mockImplementation((_id, patch) => { updates.push(patch); return Promise.resolve({}); }),
        findOne: vitest_1.vi.fn().mockResolvedValue(opts.curHs !== undefined ? { id: 9, code: 'S1', customFields: { hallStatus: opts.curHs } } : null),
    };
    const cfgRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_a = opts.cfg) !== null && _a !== void 0 ? _a : null) };
    const conn = {
        getRepository: vitest_1.vi.fn((_ctx, ent) => {
            const name = ent.name;
            if (name === 'CampusFulfillmentConfig')
                return cfgRepo;
            return orderRepo;
        }),
    };
    const slotLock = { lock: vitest_1.vi.fn().mockResolvedValue((_b = opts.slotLocked) !== null && _b !== void 0 ? _b : true) };
    const svc = new hall_service_1.HallService(conn, slotLock, { get: vitest_1.vi.fn() }, { listOnlineRiders: vitest_1.vi.fn().mockResolvedValue([]) });
    return { svc, orderRepo, cfgRepo, updates };
}
const future = (min) => new Date(Date.now() + min * 60000);
(0, vitest_1.describe)('HallService.onOrderPlaced 预约闸门', () => {
    const base = { id: 9, code: 'S1', customFields: { fulfillmentRoute: 'R3' } };
    (0, vitest_1.it)('scheduledFor 距今超 30min → 挂 scheduled 暂不入厅（不查商家配置）', async () => {
        const env = makeEnv();
        const order = Object.assign(Object.assign({}, base), { customFields: { fulfillmentRoute: 'R3', scheduledFor: future(120) } });
        await env.svc.onOrderPlaced({ channelId: 1 }, order);
        (0, vitest_1.expect)(env.updates[0].customFields.hallStatus).toBe('scheduled');
        (0, vitest_1.expect)(env.cfgRepo.findOne).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('锁位失败仍挂 scheduled 且带 campusCause=slot_full', async () => {
        const env = makeEnv({ slotLocked: false });
        const order = Object.assign(Object.assign({}, base), { customFields: { fulfillmentRoute: 'R3', scheduledFor: future(60) } });
        await env.svc.onOrderPlaced({ channelId: 1 }, order);
        (0, vitest_1.expect)(env.updates[0].customFields).toEqual({ hallStatus: 'scheduled', campusCause: 'slot_full' });
    });
    (0, vitest_1.it)('scheduledFor 距今不足 30min → 照旧即时入厅 open', async () => {
        const env = makeEnv();
        const order = Object.assign(Object.assign({}, base), { customFields: { fulfillmentRoute: 'R3', scheduledFor: future(10) } });
        await env.svc.onOrderPlaced({ channelId: 1 }, order);
        (0, vitest_1.expect)(env.updates[0].customFields.hallStatus).toBe('open');
        (0, vitest_1.expect)(env.updates[0].customFields.hallEnteredAt).toBeInstanceOf(Date);
    });
    (0, vitest_1.it)('无 scheduledFor（立即单）不受影响', async () => {
        const env = makeEnv({ cfg: { channelId: 1, merchantConfirmEnabled: false } });
        await env.svc.onOrderPlaced({ channelId: 1 }, Object.assign(Object.assign({}, base), { customFields: { fulfillmentRoute: 'R3' } }));
        (0, vitest_1.expect)(env.updates[0].customFields.hallStatus).toBe('open');
    });
});
(0, vitest_1.describe)('HallService.releaseScheduled', () => {
    const order = { id: 9, code: 'S1' };
    (0, vitest_1.it)('商家确认模式 → pending_merchant', async () => {
        const env = makeEnv();
        await env.svc.releaseScheduled({ channelId: 1 }, order, { merchantConfirmEnabled: true });
        (0, vitest_1.expect)(env.updates[0].customFields).toEqual({ hallStatus: 'pending_merchant' });
    });
    (0, vitest_1.it)('非确认模式 → 直接 open + hallEnteredAt 重置', async () => {
        const env = makeEnv();
        await env.svc.releaseScheduled({ channelId: 1 }, order, { merchantConfirmEnabled: false });
        (0, vitest_1.expect)(env.updates[0].customFields.hallStatus).toBe('open');
        (0, vitest_1.expect)(env.updates[0].customFields.hallEnteredAt).toBeInstanceOf(Date);
    });
});
(0, vitest_1.describe)('HallService.exitHall 取消脱厅（3.3）', () => {
    const order = { id: 9, code: 'S1' };
    (0, vitest_1.it)('大厅流转态 open → 清为 cancelled，不碰指派字段', async () => {
        const env = makeEnv({ curHs: 'open' });
        await env.svc.exitHall({ channelId: 1 }, order);
        (0, vitest_1.expect)(env.updates[0].customFields).toEqual({ hallStatus: 'cancelled' });
    });
    (0, vitest_1.it)('grabbed → 连带清骑手指派字段（任务卡不残留）', async () => {
        const env = makeEnv({ curHs: 'grabbed' });
        await env.svc.exitHall({ channelId: 1 }, order);
        (0, vitest_1.expect)(env.updates[0].customFields).toEqual({
            hallStatus: 'cancelled',
            deliveryStaffId: null,
            deliveryStatus: null,
            assignedAt: null,
        });
    });
    (0, vitest_1.it)('no_rider_final（T4 终态）→ 跳过不写，防竞态覆盖', async () => {
        const env = makeEnv({ curHs: 'no_rider_final' });
        await env.svc.exitHall({ channelId: 1 }, order);
        (0, vitest_1.expect)(env.updates).toHaveLength(0);
    });
    (0, vitest_1.it)('DB 无记录/无 hallStatus → 幂等跳过', async () => {
        const env = makeEnv();
        await env.svc.exitHall({ channelId: 1 }, order);
        (0, vitest_1.expect)(env.updates).toHaveLength(0);
    });
});
//# sourceMappingURL=hall.service.spec.js.map