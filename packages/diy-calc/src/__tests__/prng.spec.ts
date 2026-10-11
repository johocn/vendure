import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../prng';

describe('mulberry32 确定性伪随机', () => {
    it('同种子序列完全一致', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const seqA = Array.from({ length: 10 }, () => a());
        const seqB = Array.from({ length: 10 }, () => b());
        expect(seqA).toEqual(seqB);
    });
    it('不同种子序列不同', () => {
        const a = mulberry32(1);
        const b = mulberry32(2);
        expect(a()).not.toBe(b());
    });
    it('值域 [0,1)', () => {
        const rnd = mulberry32(7);
        for (let i = 0; i < 1000; i++) {
            const v = rnd();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
    it('整数溢出安全（负数/超大种子不抛错）', () => {
        expect(() => mulberry32(-1)()).not.toThrow();
        expect(() => mulberry32(2 ** 31)()).not.toThrow();
    });
});
