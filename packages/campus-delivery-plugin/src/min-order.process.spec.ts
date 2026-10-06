import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindMinOrderConnection, campusMinOrderProcess } from './min-order.process';

function makeData(opts: { cfg?: any; cf?: any; subTotal?: number }) {
    return {
        ctx: { channelId: 2 } as any,
        order: { subTotal: opts.subTotal ?? 1000, customFields: opts.cf ?? {} } as any,
    } as any;
}

describe('campusMinOrderProcess', () => {
    const cfgRepo = { findOne: vi.fn() };
    beforeEach(() => {
        vi.clearAllMocks();
        bindMinOrderConnection({
            getRepository: vi.fn(() => cfgRepo),
        } as any);
    });

    it('非 ArrangingPayment 过渡放行', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: 1500 });
        await expect(
            campusMinOrderProcess.onTransitionStart!('AddingItems', 'PaymentAuthorized', makeData({})),
        ).resolves.toBeUndefined();
    });

    it('未配置 minOrderAmount 放行', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: null });
        await expect(
            campusMinOrderProcess.onTransitionStart!('AddingItems', 'ArrangingPayment', makeData({ subTotal: 0 })),
        ).resolves.toBeUndefined();
    });

    it('商品单未满起送价抛 UserInputError（文案含元）', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: 1500 });
        await expect(
            campusMinOrderProcess.onTransitionStart!('AddingItems', 'ArrangingPayment', makeData({ subTotal: 1000 })),
        ).rejects.toThrow('未满起送价 ¥15');
    });

    it('商品单满足起送价放行', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: 1500 });
        await expect(
            campusMinOrderProcess.onTransitionStart!('AddingItems', 'ArrangingPayment', makeData({ subTotal: 2000 })),
        ).resolves.toBeUndefined();
    });

    it('跑腿单（orderKind=errand）豁免商品起送价', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: 1500 });
        await expect(
            campusMinOrderProcess.onTransitionStart!(
                'AddingItems', 'ArrangingPayment',
                makeData({ subTotal: 0, cf: { orderKind: 'errand' } }),
            ),
        ).resolves.toBeUndefined();
    });
});
