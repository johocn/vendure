import { describe, expect, it } from 'vitest';
import { BALANCE_PAYMENT_CODE, decideAggregation } from './order-box-aggregation';

/**
 * 聚合拆合引擎语义（支撑 checkoutSplitted 拆单决策）测试。
 * 覆盖 spec §2.4 三档规则：
 *  - 余额 → 全部箱并入 1 组（不拆单）
 *  - 非余额同租户且各箱白名单均含该方式 → 合并为 1 组
 *  - 非余额缺该方式的箱拆出（每箱独立组）；跨租户互不合单
 */
describe('decideAggregation', () => {
    const box = (boxKey: string, tenant: string, codes: string[]) => ({
        boxKey,
        profileId: boxKey.replace('box:', ''),
        tenantChannelId: tenant,
        availablePaymentMethodCodes: codes,
    });

    it('空箱 → 空结果', () => {
        const r = decideAggregation({ boxes: [], userSelectedPaymentMethod: 'cod' });
        expect(r.groups).toHaveLength(0);
        expect(r.totals).toEqual({ orderCount: 0, boxCount: 0 });
    });

    it('余额 → 全部箱合并为 1 单（跨租户跨档案不拆）', () => {
        const boxes = [
            box('box:100', 't1', [BALANCE_PAYMENT_CODE]),
            box('box:200', 't2', [BALANCE_PAYMENT_CODE, 'cod']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: BALANCE_PAYMENT_CODE });
        expect(r.groups).toHaveLength(1);
        expect(r.groups[0].groupKey).toBe('balance');
        expect(r.groups[0].boxes).toHaveLength(2);
        expect(r.groups[0].payByBalance).toBe(true);
        expect(r.totals.orderCount).toBe(1);
    });

    it('同租户、各箱均含所选方式 → 合并为 1 单', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:200', 't1', ['cod', 'alipay']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        expect(r.groups).toHaveLength(1);
        expect(r.groups[0].groupKey).toBe('tenant-t1');
        expect(r.groups[0].boxes).toHaveLength(2);
        expect(r.totals.orderCount).toBe(1);
    });

    it('同租户、缺所选方式的箱拆出为独立单', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:200', 't1', ['alipay']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        // 支持 cod 的 box:100 合单；缺 cod 的 box:200 拆出为独立单
        expect(r.totals.orderCount).toBe(2);
        const merged = r.groups.find(g => g.groupKey === 'tenant-t1')!;
        expect(merged.boxes.map(b => b.boxKey)).toEqual(['box:100']);
        const split = r.groups.find(g => g.groupKey === 'box-t1-box:200')!;
        expect(split.boxes.map(b => b.boxKey)).toEqual(['box:200']);
        expect(split.payByBalance).toBe(false);
    });

    it('跨租户 → 各租户独立单，同租户内再按方式合拆', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:300', 't2', ['cod', 'alipay']),
            box('box:400', 't2', ['alipay']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        expect(r.totals.orderCount).toBe(3); // t1 1 单 + t2 支持 1 单 + t2 缺 cod 拆 1
        const t1 = r.groups.find(g => g.groupKey === 'tenant-t1')!;
        expect(t1.boxes.map(b => b.boxKey)).toEqual(['box:100']);
        const t2Merge = r.groups.find(g => g.groupKey === 'tenant-t2')!;
        expect(t2Merge.boxes.map(b => b.boxKey)).toEqual(['box:300']);
        const t2Split = r.groups.find(g => g.groupKey === 'box-t2-box:400')!;
        expect(t2Split.boxes.map(b => b.boxKey)).toEqual(['box:400']);
    });

    it('分组箱数合计等于输入箱数', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:200', 't1', ['alipay']),
            box('box:300', 't2', ['cod']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        const totalBoxes = r.groups.reduce((sum, g) => sum + g.boxes.length, 0);
        expect(totalBoxes).toBe(3);
    });
});