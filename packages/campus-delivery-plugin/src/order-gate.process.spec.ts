import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    bindOrderGateConnection,
    campusOrderGateProcess,
    findSoldOutProductName,
    isBlacklisted,
} from './order-gate.process';

/** 当前校园时刻在营业时间内（10:00-22:00 用真实时间无法稳定断言，这里用「未配置」场景之外的分支单测） */

function data(opts: { channelCf?: any; cf?: any; id?: number; channelId?: number } = {}) {
    return {
        ctx: {
            channelId: opts.channelId ?? 2,
            channel: { customFields: opts.channelCf ?? {} },
        } as any,
        order: { id: opts.id ?? 101, customFields: opts.cf ?? {} } as any,
    } as any;
}

describe('campusOrderGateProcess', () => {
    const query = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        // 固定校园时刻 12:00（UTC+8 → UTC 04:00），让营业时间判断可稳定断言
        vi.useFakeTimers();
        vi.setSystemTime(new Date(Date.UTC(2026, 9, 25, 4, 0, 0)));
        bindOrderGateConnection({ rawConnection: { query } } as any);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('非 ArrangingPayment 放行（不做任何查询）', async () => {
        await expect(
            campusOrderGateProcess.onTransitionStart!('AddingItems', 'PaymentAuthorized', data()),
        ).resolves.toBeUndefined();
        expect(query).not.toHaveBeenCalled();
    });

    it('已打烊拦截（当前 12:00 不在 10:00-11:00 营业时段）', async () => {
        await expect(
            campusOrderGateProcess.onTransitionStart!('AddingItems', 'ArrangingPayment', data({ channelCf: { waimaiBusinessHours: '10:00-11:00' } })),
        ).rejects.toThrow('店铺已打烊');
        expect(query).not.toHaveBeenCalled();
    });

    it('跑腿单豁免营业时间校验', async () => {
        query.mockResolvedValue([]);
        await expect(
            campusOrderGateProcess.onTransitionStart!(
                'AddingItems', 'ArrangingPayment',
                data({ channelCf: { waimaiBusinessHours: '10:00-11:00' }, cf: { orderKind: 'errand' } }),
            ),
        ).resolves.toBeUndefined();
    });

    it('黑名单命中拦截', async () => {
        query
            .mockResolvedValueOnce([{ customerId: 9, phone: '13800000000' }])
            .mockResolvedValueOnce([{ exists: 1 }]);
        await expect(
            campusOrderGateProcess.onTransitionStart!('AddingItems', 'ArrangingPayment', data()),
        ).rejects.toThrow('暂不可下单');
    });

    it('商品沽清拦截（文案带商品名）', async () => {
        query
            .mockResolvedValueOnce([{ customerId: 9, phone: null }]) // 顾客查询
            .mockResolvedValueOnce([])                             // 黑名单未命中
            .mockResolvedValueOnce([{ name: '香辣鸡腿堡' }]);        // 沽清命中
        await expect(
            campusOrderGateProcess.onTransitionStart!('AddingItems', 'ArrangingPayment', data()),
        ).rejects.toThrow('香辣鸡腿堡');
    });

    it('无黑名单/无沽清时放行', async () => {
        query
            .mockResolvedValueOnce([{ customerId: 9, phone: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        await expect(
            campusOrderGateProcess.onTransitionStart!('AddingItems', 'ArrangingPayment', data()),
        ).resolves.toBeUndefined();
    });
});

describe('helpers', () => {
    it('isBlacklisted：无顾客记录返回 false', async () => {
        const conn: any = { rawConnection: { query: vi.fn().mockResolvedValue([]) } };
        await expect(isBlacklisted(conn, 2, 1)).resolves.toBe(false);
    });

    it('findSoldOutProductName：无命中返回 null', async () => {
        const conn: any = { rawConnection: { query: vi.fn().mockResolvedValue([]) } };
        await expect(findSoldOutProductName(conn, 1)).resolves.toBeNull();
    });
});
