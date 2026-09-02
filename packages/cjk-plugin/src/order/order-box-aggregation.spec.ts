import { describe, expect, it } from 'vitest';
import { BALANCE_PAYMENT_CODE, decideAggregation } from './order-box-aggregation';

/**
 * 聚合拆合引擎语义（支撑 checkoutSplitted 拆单决策）测试。
 * 覆盖默认档规则：
 *  - 余额 → 全部箱并入 1 组（不拆单，payByBalance=true）
 *  - 各箱可用支付方式「交集」包含所选方式 → 合并为 1 组（payByBalance=false，台账另行分账）
 *  - 所选方式不在交集（或各箱方式互不相交）→ 按箱全拆，每箱独立成单
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

    it('所选支付方式位于各箱共同交集 → 合并为 1 单（payByBalance=false）', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:200', 't1', ['cod', 'alipay']),
            box('box:300', 't2', ['cod']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        expect(r.groups).toHaveLength(1);
        expect(r.groups[0].groupKey).toBe('shared');
        expect(r.groups[0].boxes).toHaveLength(3);
        expect(r.groups[0].payByBalance).toBe(false);
        expect(r.totals.orderCount).toBe(1);
        expect(r.totals.boxCount).toBe(3);
    });

    it('交集不含所选方式（缺该方式的箱） → 按箱全拆', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:200', 't1', ['alipay']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        expect(r.totals.orderCount).toBe(2);
        expect(r.groups.map(g => g.boxes[0].boxKey)).toEqual(['box:100', 'box:200']);
        expect(r.groups[0].payByBalance).toBe(false);
        expect(r.groups[1].payByBalance).toBe(false);
    });

    it('各箱可用方式互不相交 → 按箱全拆', () => {
        const boxes = [
            box('box:100', 't1', ['alipay']),
            box('box:200', 't2', ['wechat']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'alipay' });
        expect(r.totals.orderCount).toBe(2);
        expect(r.groups.map(g => g.boxes[0].boxKey)).toEqual(['box:100', 'box:200']);
    });

    it('非余额：跨租户、缺所选方式的箱 → 按箱全拆', () => {
        const boxes = [
            box('box:100', 't1', ['cod']),
            box('box:300', 't2', ['cod', 'alipay']),
            box('box:400', 't2', ['alipay']),
        ];
        const r = decideAggregation({ boxes, userSelectedPaymentMethod: 'cod' });
        // 交集为空（box:400 无 cod）→ 各箱独立成单，共 3 单
        expect(r.totals.orderCount).toBe(3);
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