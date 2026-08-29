import { describe, expect, it } from 'vitest';
import { BALANCE_PAYMENT_CODE, decideAggregation } from './order-box-aggregation';

/**
 * 聚合拆合引擎语义（支撑 checkoutSplitted 拆单决策）测试。
 * 覆盖 spec §2.4 三档规则（用户定稿后）：
 *  - 余额 → 全部箱并入 1 组（不拆单）
 *  - 非余额方式 → 一律按箱全拆，每箱独立成单（每配送档案一单），不做同租户/白名单合并
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

    it('非余额：同租户多箱 → 一律按箱全拆（不做白名单/同租户合并）', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:200', 't1', ['cod', 'alipay']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        expect(r.groups).toHaveLength(2);
        expect(r.totals.orderCount).toBe(2);
        expect(r.groups.every(g => g.boxes.length === 1 && g.payByBalance === false)).toBe(true);
        expect(r.groups.map(g => g.boxes[0].boxKey)).toEqual(['box:100', 'box:200']);
    });

    it('非余额：同租户、缺所选方式的箱 → 同样独立成单', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:200', 't1', ['alipay']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        // 选非余额方式一律每箱一单，不做任何合并
        expect(r.totals.orderCount).toBe(2);
        const b1 = r.groups.find(g => g.boxes[0].boxKey === 'box:100')!;
        const b2 = r.groups.find(g => g.boxes[0].boxKey === 'box:200')!;
        expect(b1.boxes.map(b => b.boxKey)).toEqual(['box:100']);
        expect(b2.boxes.map(b => b.boxKey)).toEqual(['box:200']);
        expect(b2.payByBalance).toBe(false);
    });

    it('非余额：跨租户 → 每箱独立单（含同一租户多箱）', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:300', 't2', ['cod', 'alipay']),
            box('box:400', 't2', ['alipay']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        expect(r.totals.orderCount).toBe(3); // 每箱一单，共 3 单
        expect(r.groups.map(g => g.boxes[0].boxKey).sort()).toEqual(['box:100', 'box:300', 'box:400']);
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