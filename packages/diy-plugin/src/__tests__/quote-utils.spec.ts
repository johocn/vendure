import { describe, expect, it } from 'vitest';

import { buildQuoteNo, quoteExpiresAt } from '../quote-utils';

describe('buildQuoteNo', () => {
    it('matches DIY-YYYYMMDD-XXXXXX', () => {
        const no = buildQuoteNo(new Date('2026-10-11T08:30:00'));
        expect(no).toMatch(/^DIY-20261011-[2-9A-HJ-NP-Z]{6}$/);
    });

    it('is deterministic under injected random', () => {
        expect(buildQuoteNo(new Date('2026-10-11'), () => 0)).toBe('DIY-20261011-222222');
        expect(buildQuoteNo(new Date('2026-10-11'), () => 0.9999999)).toBe('DIY-20261011-ZZZZZZ');
    });

    it('never contains confusable chars 0/O/1/I across many draws', () => {
        for (let i = 0; i < 500; i++) {
            const no = buildQuoteNo(new Date(), Math.random);
            expect(no.slice(-6)).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
        }
    });
});

describe('quoteExpiresAt', () => {
    it('adds ttl days preserving time-of-day', () => {
        const now = new Date('2026-10-11T12:00:00Z');
        expect(quoteExpiresAt(now, 7).toISOString()).toBe(new Date('2026-10-18T12:00:00Z').toISOString());
    });
});
