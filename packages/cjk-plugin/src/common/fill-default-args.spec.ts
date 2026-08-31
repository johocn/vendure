import { describe, it, expect } from 'vitest';
import { fillDefaultArgs, OperationInput, OperationArgsDefLike } from './fill-default-args';

const defs: OperationArgsDefLike[] = [
    {
        code: 'default-shipping-eligibility-checker',
        args: { orderMinimum: { defaultValue: 0 } },
    },
];

const op = (arguments_: Array<{ name: string; value: string }>): OperationInput =>
    ({ code: 'default-shipping-eligibility-checker', arguments: arguments_ });

describe('fillDefaultArgs', () => {
    it('缺省参数时为缺失项补 defaultValue', () => {
        const result = fillDefaultArgs(op([]), defs);
        expect(result?.arguments).toContainEqual({ name: 'orderMinimum', value: '0' });
    });

    it('已传值的参数不被覆盖', () => {
        const result = fillDefaultArgs(op([{ name: 'orderMinimum', value: '99' }]), defs);
        expect(result?.arguments).toEqual([{ name: 'orderMinimum', value: '99' }]);
    });

    it('code 不匹配时原样返回', () => {
        const result = fillDefaultArgs(
            { code: 'unknown-checker', arguments: [] },
            defs,
        );
        expect(result).toEqual({ code: 'unknown-checker', arguments: [] });
    });

    it('null/undefined 返回 null', () => {
        expect(fillDefaultArgs(null, defs)).toBe(null);
        expect(fillDefaultArgs(undefined, defs)).toBe(null);
    });
});