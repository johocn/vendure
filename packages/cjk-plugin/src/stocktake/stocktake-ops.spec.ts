import { describe, expect, it } from 'vitest';

import { parseStateFilter } from './stocktake-math';

describe('parseStateFilter（规格 §7.1）', () => {
    it('state 单值优先于 states', () => {
        expect(parseStateFilter({ state: 'OPEN', states: ['POSTED'] }))
            .toEqual({ mode: 'one', values: ['OPEN'] });
    });

    it('无 state 时用 states 多值，并过滤空串与空白', () => {
        expect(parseStateFilter({ states: ['POSTED', '', '  ', 'CANCELLED'] }))
            .toEqual({ mode: 'many', values: ['POSTED', 'CANCELLED'] });
    });

    it('都为空 → 不过滤', () => {
        expect(parseStateFilter({})).toEqual({ mode: 'none', values: [] });
        expect(parseStateFilter({ states: [] })).toEqual({ mode: 'none', values: [] });
        expect(parseStateFilter({ state: '', states: [] })).toEqual({ mode: 'none', values: [] });
    });
});