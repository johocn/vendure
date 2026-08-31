import { describe, it, expect } from 'vitest';
import { tieredShippingEligibilityChecker as checker } from './tiered-shipping-eligibility-checker';

// Access the raw check function passed to the constructor. `checker.check` is the
// ShippingEligibilityChecker class method (unbound `this` + argsArrayToHash), so we
// test the underlying checkFn directly with plain args hashes.
const check = (checker as any).checkFn as (ctx: unknown, order: any, args: any) => Promise<boolean | string>;

describe('tieredShippingEligibilityChecker', () => {
    it('缺 orderMinimum 时按 0 处理（无门槛，允许）', async () => {
        const result = await check({}, { subTotalWithTax: 100 }, {});
        expect(result).toBe(true);
    });

    it('orderMinimum 显式门槛达标时允许', async () => {
        const result = await check({}, { subTotalWithTax: 200 }, { orderMinimum: 100 });
        expect(result).toBe(true);
    });

    it('orderMinimum 显式门槛未达标时拒绝', async () => {
        const result = await check({}, { subTotalWithTax: 50 }, { orderMinimum: 100 });
        expect(result).toBe(false);
    });
});