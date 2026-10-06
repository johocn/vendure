"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 纯逻辑单测：状态机（assigned 可开始 / 状态不符拒）、分成计算（100% 与 80%）、照片必传、非本骑手拒
const vitest_1 = require("vitest");
const rider_task_service_1 = require("./rider-task.service");
function make(order, cfg = { riderCommissionRate: 100 }) {
    const riderSvc = { assertApprovedRider: vitest_1.vi.fn().mockResolvedValue({ id: 9 }) };
    const saved = [];
    // findOne 调用次序：deliver = assertOwner(查单) → getConfig(查配置)；start = assertOwner(查单)
    const repo = {
        findOne: vitest_1.vi.fn().mockImplementation((opts) => { var _a; return ((_a = opts === null || opts === void 0 ? void 0 : opts.where) === null || _a === void 0 ? void 0 : _a.channelId) !== undefined ? Promise.resolve(cfg) : Promise.resolve(order); }),
        update: vitest_1.vi.fn().mockResolvedValue({}),
        save: vitest_1.vi.fn().mockImplementation((v) => {
            saved.push(v);
            return Promise.resolve(v);
        }),
    };
    const conn = { getRepository: () => repo };
    return { svc: new rider_task_service_1.RiderTaskService(conn, riderSvc, { adjust: vitest_1.vi.fn().mockResolvedValue(102) }, { backToHall: vitest_1.vi.fn() }), repo, saved };
}
const assigned = { id: 10, code: 'A1', shipping: 300, customFields: { deliveryStaffId: '9', deliveryStatus: 'assigned', tip: 100 } };
(0, vitest_1.describe)('RiderTaskService', () => {
    (0, vitest_1.it)('assigned 可开始配送', async () => {
        const { svc, repo } = make(assigned);
        await svc.start({ channelId: 1 }, 10);
        (0, vitest_1.expect)(repo.update).toHaveBeenCalledWith(10, vitest_1.expect.objectContaining({ customFields: { deliveryStatus: 'in_progress' } }));
    });
    (0, vitest_1.it)('delivered 需照片且分成=配送费+小费', async () => {
        const inProg = Object.assign(Object.assign({}, assigned), { customFields: Object.assign(Object.assign({}, assigned.customFields), { deliveryStatus: 'in_progress' }) });
        const { svc, repo, saved } = make(inProg, { riderCommissionRate: 100 });
        await svc.deliver({ channelId: 1 }, 10, ['p1']);
        (0, vitest_1.expect)(repo.update).toHaveBeenCalled();
        (0, vitest_1.expect)(saved[0].amount).toBe(400); // 300 shipping + 100 tip
    });
    (0, vitest_1.it)('分成比例 80%', async () => {
        const inProg = Object.assign(Object.assign({}, assigned), { customFields: Object.assign(Object.assign({}, assigned.customFields), { deliveryStatus: 'in_progress' }) });
        const { svc, saved } = make(inProg, { riderCommissionRate: 80 });
        await svc.deliver({ channelId: 1 }, 10, ['p1']);
        (0, vitest_1.expect)(saved[0].amount).toBe(320);
    });
    (0, vitest_1.it)('无照片拒单', async () => {
        const inProg = Object.assign(Object.assign({}, assigned), { customFields: Object.assign(Object.assign({}, assigned.customFields), { deliveryStatus: 'in_progress' }) });
        const { svc } = make(inProg);
        await (0, vitest_1.expect)(svc.deliver({ channelId: 1 }, 10, [])).rejects.toThrow('送达需至少一张照片');
    });
    (0, vitest_1.it)('非本骑手拒', async () => {
        const other = Object.assign(Object.assign({}, assigned), { customFields: { deliveryStaffId: '8', deliveryStatus: 'assigned' } });
        const { svc } = make(other);
        await (0, vitest_1.expect)(svc.start({ channelId: 1 }, 10)).rejects.toThrow();
    });
    (0, vitest_1.it)('0 分成单（0 运费 0 小费）不入账不写 earning 且不抛错', async () => {
        const zero = { id: 11, code: 'A2', shipping: 0, customFields: { deliveryStaffId: '9', deliveryStatus: 'in_progress', tip: 0 } };
        const { svc, saved } = make(zero, { riderCommissionRate: 80 });
        const order = await svc.deliver({ channelId: 1 }, 11, ['p1']);
        (0, vitest_1.expect)(order).toBeTruthy();
        (0, vitest_1.expect)(saved).toHaveLength(0); // 未写 RiderEarning
    });
    (0, vitest_1.it)('有运费但分成 0（rate=0）仍写 earning 走入账分支', async () => {
        const inProg = Object.assign(Object.assign({}, assigned), { customFields: Object.assign(Object.assign({}, assigned.customFields), { deliveryStatus: 'in_progress' }) });
        const { svc, saved } = make(inProg, { riderCommissionRate: 0 });
        await svc.deliver({ channelId: 1 }, 10, ['p1']);
        (0, vitest_1.expect)(saved).toHaveLength(1);
        (0, vitest_1.expect)(saved[0].amount).toBe(0);
    });
});
//# sourceMappingURL=rider-task.service.spec.js.map