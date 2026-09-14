import { describe, expect, it } from 'vitest';
import { DiffOrderInput, diffOrder } from './diff-rules';

const baseOrder: DiffOrderInput['order'] = {
    id: 'o1',
    totalWithTax: 10000,
    state: 'Delivered',
    customFields: {},
};

describe('diffOrder', () => {
    it('全闭环无差异', () => {
        const input: DiffOrderInput = {
            order: baseOrder,
            deliveryRecords: [{ mode: 'self', sourceLocationId: 'l1', status: 'Delivered' }],
            ledgerOuts: [{ sourceLocationId: 'l1', quantity: 1 }],
            settlements: [{ status: 'PAID', amount: 10000 }],
            mirrorDiff: 0,
        };
        expect(diffOrder(input)).toEqual([]);
    });

    it('D1 缺配送记录', () => {
        const input: DiffOrderInput = {
            order: baseOrder,
            deliveryRecords: [],
            ledgerOuts: [{ sourceLocationId: 'l1', quantity: 1 }],
            settlements: [{ status: 'PAID', amount: 10000 }],
            mirrorDiff: 0,
        };
        expect(diffOrder(input)).toContain('D1');
    });

    it('D2 扣仓不一致', () => {
        const input: DiffOrderInput = {
            order: baseOrder,
            deliveryRecords: [{ mode: 'self', sourceLocationId: 'l2', status: 'Delivered' }],
            ledgerOuts: [{ sourceLocationId: 'l1', quantity: 1 }],
            settlements: [{ status: 'PAID', amount: 10000 }],
            mirrorDiff: 0,
        };
        expect(diffOrder(input)).toContain('D2');
    });

    it('D3 金额不平（含 COD 未签收不算差）', () => {
        const paid: DiffOrderInput = {
            order: baseOrder,
            deliveryRecords: [{ mode: 'self', sourceLocationId: 'l1', status: 'Delivered' }],
            ledgerOuts: [{ sourceLocationId: 'l1', quantity: 1 }],
            settlements: [{ status: 'PENDING_SIGN', amount: 10000 }],
            mirrorDiff: 0,
        };
        expect(diffOrder(paid)).not.toContain('D3'); // COD 未签收不算差

        const short: DiffOrderInput = {
            order: baseOrder,
            deliveryRecords: [{ mode: 'self', sourceLocationId: 'l1', status: 'Delivered' }],
            ledgerOuts: [{ sourceLocationId: 'l1', quantity: 1 }],
            settlements: [{ status: 'PAID', amount: 8000 }],
            mirrorDiff: 0,
        };
        expect(diffOrder(short)).toContain('D3');
    });

    it('D4 镜像不平', () => {
        const input: DiffOrderInput = {
            order: baseOrder,
            deliveryRecords: [{ mode: 'self', sourceLocationId: 'l1', status: 'Delivered' }],
            ledgerOuts: [{ sourceLocationId: 'l1', quantity: 1 }],
            settlements: [{ status: 'PAID', amount: 10000 }],
            mirrorDiff: 5,
        };
        expect(diffOrder(input)).toContain('D4');
    });

    it('退款单不参与 D3', () => {
        const input: DiffOrderInput = {
            order: { ...baseOrder, state: 'Cancelled' },
            deliveryRecords: [],
            ledgerOuts: [],
            settlements: [],
            mirrorDiff: 0,
            cancelled: true,
        };
        expect(diffOrder(input)).not.toContain('D3');
    });
});
