import { describe, expect, it, vi } from 'vitest';
import { CampusErrandShippingLineAssignmentStrategy } from './errand-shipping-line-assignment';

function makeEnv() {
    const delegate = {
        assignShippingLineToOrderLines: vi.fn().mockResolvedValue([{ id: 11 }]),
        init: vi.fn(),
    };
    const strategy = new CampusErrandShippingLineAssignmentStrategy(delegate as any);
    return { strategy, delegate };
}

describe('CampusErrandShippingLineAssignmentStrategy', () => {
    it('跑腿单（orderKind=errand）全量分配 order.lines，不走 delegate', async () => {
        const { strategy, delegate } = makeEnv();
        const lines = [{ id: 1 }, { id: 2 }];
        const order = { id: 100, customFields: { orderKind: 'errand' }, lines };
        const res = await strategy.assignShippingLineToOrderLines({} as any, { id: 9 } as any, order as any);
        expect(res).toBe(lines);
        expect(delegate.assignShippingLineToOrderLines).not.toHaveBeenCalled();
    });

    it('非跑腿单委托既有策略（透传 ctx/shippingLine/order 与返回值）', async () => {
        const { strategy, delegate } = makeEnv();
        const order = { id: 101, customFields: { orderKind: 'normal' }, lines: [{ id: 5 }] };
        const ctx = { channelId: 1 } as any;
        const line = { id: 9 } as any;
        const res = await strategy.assignShippingLineToOrderLines(ctx, line, order as any);
        expect(res).toEqual([{ id: 11 }]);
        expect(delegate.assignShippingLineToOrderLines).toHaveBeenCalledWith(ctx, line, order);
    });

    it('customFields 缺失时按非跑腿处理', async () => {
        const { strategy, delegate } = makeEnv();
        const order = { id: 102, lines: [] };
        await strategy.assignShippingLineToOrderLines({} as any, { id: 9 } as any, order as any);
        expect(delegate.assignShippingLineToOrderLines).toHaveBeenCalled();
    });

    it('init 转发给 delegate（Box 需 init 注入 ShippingProfileService）', () => {
        const { strategy, delegate } = makeEnv();
        const injector = { get: vi.fn() } as any;
        strategy.init(injector);
        expect(delegate.init).toHaveBeenCalledWith(injector);
    });
});
