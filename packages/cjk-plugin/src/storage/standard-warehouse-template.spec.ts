import { describe, expect, it } from 'vitest';

import {
    STANDARD_BIN_COUNT,
    STANDARD_WAREHOUSE_ZONES,
    binCode,
    expandZone,
} from './standard-warehouse-template';

describe('标准仓库模板', () => {
    it('总库位数为 18', () => {
        expect(STANDARD_BIN_COUNT).toBe(18);
    });

    it('A 区展开为 10 个库位，编码零填充', () => {
        const a = STANDARD_WAREHOUSE_ZONES.find((z) => z.code === 'A')!;
        const bins = expandZone(a);
        expect(bins).toHaveLength(10);
        expect(bins[0].code).toBe('A-01-01');
        expect(bins[9].code).toBe('A-02-05');
    });

    it('编码零填充避免 A-10 < A-2 的字符串排序坑', () => {
        expect(binCode('A', 2, 1)).toBe('A-02-01');
        expect(binCode('A', 10, 1)).toBe('A-10-01');
        expect('A-02-01' < 'A-10-01').toBe(true);
    });
});