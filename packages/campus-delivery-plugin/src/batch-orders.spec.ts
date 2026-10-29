import { describe, expect, it } from 'vitest';
import { BATCH_ORDER_MAX, BatchOrderInputError, normalizeBatchOrderIds } from './batch-orders';

describe('normalizeBatchOrderIds', () => {
    it('去空白、去重并保持勾选顺序', () => {
        expect(normalizeBatchOrderIds(['101', ' 102 ', '', '101', null])).toEqual(['101', '102']);
    });

    it('单值入参也接受（后台单选复用同一入口）', () => {
        expect(normalizeBatchOrderIds(103)).toEqual(['103']);
    });

    it('空集合 / 全空白直接报错', () => {
        expect(() => normalizeBatchOrderIds([])).toThrow(BatchOrderInputError);
        expect(() => normalizeBatchOrderIds(['', '   '])).toThrow(BatchOrderInputError);
        expect(() => normalizeBatchOrderIds(null)).toThrow(BatchOrderInputError);
    });

    it('恰好上限可用，超出上限报错', () => {
        const atMax = Array.from({ length: BATCH_ORDER_MAX }, (_, i) => String(1000 + i));
        expect(normalizeBatchOrderIds(atMax)).toHaveLength(BATCH_ORDER_MAX);
        expect(() => normalizeBatchOrderIds([...atMax, '9999'])).toThrow(/最多批量操作/);
    });

    it('重复项不占用上限名额', () => {
        const duplicated = Array.from({ length: BATCH_ORDER_MAX * 2 }, () => '101');
        expect(normalizeBatchOrderIds(duplicated)).toEqual(['101']);
    });
});
