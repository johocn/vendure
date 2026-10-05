"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const errand_shipping_line_assignment_1 = require("./errand-shipping-line-assignment");
function makeEnv() {
    const delegate = {
        assignShippingLineToOrderLines: vitest_1.vi.fn().mockResolvedValue([{ id: 11 }]),
        init: vitest_1.vi.fn(),
    };
    const strategy = new errand_shipping_line_assignment_1.CampusErrandShippingLineAssignmentStrategy(delegate);
    return { strategy, delegate };
}
(0, vitest_1.describe)('CampusErrandShippingLineAssignmentStrategy', () => {
    (0, vitest_1.it)('跑腿单（orderKind=errand）全量分配 order.lines，不走 delegate', async () => {
        const { strategy, delegate } = makeEnv();
        const lines = [{ id: 1 }, { id: 2 }];
        const order = { id: 100, customFields: { orderKind: 'errand' }, lines };
        const res = await strategy.assignShippingLineToOrderLines({}, { id: 9 }, order);
        (0, vitest_1.expect)(res).toBe(lines);
        (0, vitest_1.expect)(delegate.assignShippingLineToOrderLines).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('非跑腿单委托既有策略（透传 ctx/shippingLine/order 与返回值）', async () => {
        const { strategy, delegate } = makeEnv();
        const order = { id: 101, customFields: { orderKind: 'normal' }, lines: [{ id: 5 }] };
        const ctx = { channelId: 1 };
        const line = { id: 9 };
        const res = await strategy.assignShippingLineToOrderLines(ctx, line, order);
        (0, vitest_1.expect)(res).toEqual([{ id: 11 }]);
        (0, vitest_1.expect)(delegate.assignShippingLineToOrderLines).toHaveBeenCalledWith(ctx, line, order);
    });
    (0, vitest_1.it)('customFields 缺失时按非跑腿处理', async () => {
        const { strategy, delegate } = makeEnv();
        const order = { id: 102, lines: [] };
        await strategy.assignShippingLineToOrderLines({}, { id: 9 }, order);
        (0, vitest_1.expect)(delegate.assignShippingLineToOrderLines).toHaveBeenCalled();
    });
    (0, vitest_1.it)('init 转发给 delegate（Box 需 init 注入 ShippingProfileService）', () => {
        const { strategy, delegate } = makeEnv();
        const injector = { get: vitest_1.vi.fn() };
        strategy.init(injector);
        (0, vitest_1.expect)(delegate.init).toHaveBeenCalledWith(injector);
    });
});
//# sourceMappingURL=errand-shipping-line-assignment.spec.js.map