import { describe, it, expect } from 'vitest';
import { decideAggregation, BALANCE_PAYMENT_CODE } from './order-box-aggregation';
import type { AggregationInput, AggregationBox } from './order-box-aggregation';

function box(partial: Partial<AggregationBox>): AggregationBox {
    return {
        boxKey: 'box:default',
        profileId: 'p1',
        tenantChannelId: 't1',
        availablePaymentMethodCodes: ['balance-wallet'],
        ...partial,
    };
}

const WECHAT = 'wechat-pay';

describe('decideAggregation', () => {
    it('余额支付 → 全部 boxes 合并为 1 个 order (orderCount=1, role balance)', () => {
        const input: AggregationInput = {
            userSelectedPaymentMethod: BALANCE_PAYMENT_CODE,
            boxes: [
                box({ boxKey: 'box:a', tenantChannelId: 't1' }),
                box({ boxKey: 'box:b', tenantChannelId: 't2' }),
                box({ boxKey: 'box:c', tenantChannelId: 't3' }),
            ],
        };
        const res = decideAggregation(input);
        expect(res.groups).toHaveLength(1);
        expect(res.groups[0].groupKey).toBe('balance');
        expect(res.groups[0].payByBalance).toBe(true);
        expect(res.groups[0].boxes).toHaveLength(3);
        expect(res.totals).toEqual({ orderCount: 1, boxCount: 3 });
    });

    it('非余额 且 全部同租户同支持 M → 单一 group', () => {
        const input: AggregationInput = {
            userSelectedPaymentMethod: WECHAT,
            boxes: [
                box({ boxKey: 'box:a', tenantChannelId: 't1', availablePaymentMethodCodes: [WECHAT] }),
                box({ boxKey: 'box:b', tenantChannelId: 't1', availablePaymentMethodCodes: [WECHAT] }),
            ],
        };
        const res = decideAggregation(input);
        expect(res.groups).toHaveLength(1);
        expect(res.groups[0].groupKey).toBe('tenant-t1');
        expect(res.groups[0].payByBalance).toBe(false);
        expect(res.totals).toEqual({ orderCount: 1, boxCount: 2 });
    });

    it('非余额 跨租户 → 每租户独立 group', () => {
        const input: AggregationInput = {
            userSelectedPaymentMethod: WECHAT,
            boxes: [
                box({ boxKey: 'box:a', tenantChannelId: 't1', availablePaymentMethodCodes: [WECHAT] }),
                box({ boxKey: 'box:b', tenantChannelId: 't2', availablePaymentMethodCodes: [WECHAT] }),
            ],
        };
        const res = decideAggregation(input);
        expect(res.groups).toHaveLength(2);
        expect(res.groups.map(g => g.groupKey).sort()).toEqual(['tenant-t1', 'tenant-t2']);
        expect(res.totals).toEqual({ orderCount: 2, boxCount: 2 });
    });

    it('非余额 某箱缺 M → 该箱独立 group，其余合单', () => {
        const input: AggregationInput = {
            userSelectedPaymentMethod: WECHAT,
            boxes: [
                box({ boxKey: 'box:a', tenantChannelId: 't1', availablePaymentMethodCodes: [WECHAT] }),
                box({ boxKey: 'box:b', tenantChannelId: 't1', availablePaymentMethodCodes: [WECHAT] }),
                // 缺 M → 拆出
                box({ boxKey: 'box:c', tenantChannelId: 't1', availablePaymentMethodCodes: ['cash'] }),
            ],
        };
        const res = decideAggregation(input);
        expect(res.groups).toHaveLength(2);
        const merged = res.groups.find(g => g.groupKey === 'tenant-t1')!;
        const solo = res.groups.find(g => g.groupKey === 'box-t1-box:c')!;
        expect(merged.boxes.map(b => b.boxKey)).toEqual(['box:a', 'box:b']);
        expect(solo.boxes.map(b => b.boxKey)).toEqual(['box:c']);
        expect(res.totals).toEqual({ orderCount: 2, boxCount: 3 });
    });

    it('非余额 跨租户且某箱缺 M → 组合拆分', () => {
        const input: AggregationInput = {
            userSelectedPaymentMethod: WECHAT,
            boxes: [
                box({ boxKey: 'box:a', tenantChannelId: 't1', availablePaymentMethodCodes: [WECHAT] }),
                box({ boxKey: 'box:b', tenantChannelId: 't2', availablePaymentMethodCodes: [] }),
            ],
        };
        const res = decideAggregation(input);
        expect(res.groups).toHaveLength(2);
        expect(res.groups[0].groupKey).toBe('tenant-t1');
        expect(res.groups[1].groupKey).toBe('box-t2-box:b');
        expect(res.totals).toEqual({ orderCount: 2, boxCount: 2 });
    });

    it('整个租户都不支持 M → 每个 box 各为独立 group，不生成空合单组', () => {
        const input: AggregationInput = {
            userSelectedPaymentMethod: WECHAT,
            boxes: [
                box({ boxKey: 'box:a', tenantChannelId: 't1', availablePaymentMethodCodes: [] }),
                box({ boxKey: 'box:b', tenantChannelId: 't1', availablePaymentMethodCodes: [] }),
            ],
        };
        const res = decideAggregation(input);
        expect(res.groups).toHaveLength(2);
        expect(res.groups.every(g => g.groupKey.startsWith('box-'))).toBe(true);
        expect(res.totals).toEqual({ orderCount: 2, boxCount: 2 });
    });

    it('空 boxes → 空结果', () => {
        const res = decideAggregation({ userSelectedPaymentMethod: WECHAT, boxes: [] });
        expect(res.groups).toHaveLength(0);
        expect(res.totals).toEqual({ orderCount: 0, boxCount: 0 });
    });

    it('boxCount 恒等于输入 box 总数（合箱不会丢箱）', () => {
        const input: AggregationInput = {
            userSelectedPaymentMethod: 'alipay',
            boxes: [
                box({ boxKey: 'box:a', tenantChannelId: 't1', availablePaymentMethodCodes: ['alipay'] }),
                box({ boxKey: 'box:b', tenantChannelId: 't2', availablePaymentMethodCodes: ['cash'] }),
                box({ boxKey: 'box:c', tenantChannelId: 't2', availablePaymentMethodCodes: ['alipay'] }),
                box({ boxKey: 'box:d', tenantChannelId: 't3', availablePaymentMethodCodes: ['cash'] }),
            ],
        };
        const res = decideAggregation(input);
        const total = res.groups.reduce((s, g) => s + g.boxes.length, 0);
        expect(total).toBe(4);
        expect(res.totals.boxCount).toBe(4);
    });
});