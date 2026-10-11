"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prng_1 = require("../prng");
(0, vitest_1.describe)('mulberry32 确定性伪随机', () => {
    (0, vitest_1.it)('同种子序列完全一致', () => {
        const a = (0, prng_1.mulberry32)(42);
        const b = (0, prng_1.mulberry32)(42);
        const seqA = Array.from({ length: 10 }, () => a());
        const seqB = Array.from({ length: 10 }, () => b());
        (0, vitest_1.expect)(seqA).toEqual(seqB);
    });
    (0, vitest_1.it)('不同种子序列不同', () => {
        const a = (0, prng_1.mulberry32)(1);
        const b = (0, prng_1.mulberry32)(2);
        (0, vitest_1.expect)(a()).not.toBe(b());
    });
    (0, vitest_1.it)('值域 [0,1)', () => {
        const rnd = (0, prng_1.mulberry32)(7);
        for (let i = 0; i < 1000; i++) {
            const v = rnd();
            (0, vitest_1.expect)(v).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(v).toBeLessThan(1);
        }
    });
    (0, vitest_1.it)('整数溢出安全（负数/超大种子不抛错）', () => {
        (0, vitest_1.expect)(() => (0, prng_1.mulberry32)(-1)()).not.toThrow();
        (0, vitest_1.expect)(() => (0, prng_1.mulberry32)(2 ** 31)()).not.toThrow();
    });
});
//# sourceMappingURL=prng.spec.js.map