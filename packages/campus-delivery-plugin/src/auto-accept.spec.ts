import { describe, expect, it } from 'vitest';
import {
    AUTO_ACCEPT_ROUTES,
    canAutoAcceptStatus,
    isAutoAcceptDue,
    normalizeAutoAcceptRoutes,
} from './auto-accept';

const base = {
    enabled: true,
    openNow: true,
    elapsedMs: 31_000,
    delaySeconds: 30,
    route: 'R1',
    routes: [...AUTO_ACCEPT_ROUTES],
    acceptedToday: 0,
    dailyLimit: 0,
};

describe('normalizeAutoAcceptRoutes', () => {
    it('默认全部路线，未知路线丢弃', () => {
        expect(normalizeAutoAcceptRoutes(null)).toEqual(['R1', 'R2', 'R3']);
        expect(normalizeAutoAcceptRoutes(['r1', 'R5', 'R2', 'r1'])).toEqual(['R1', 'R2']);
    });

    it('支持逗号字符串，空数组回落全部', () => {
        expect(normalizeAutoAcceptRoutes('R2,R3')).toEqual(['R2', 'R3']);
        expect(normalizeAutoAcceptRoutes([])).toEqual(['R1', 'R2', 'R3']);
    });
});

describe('isAutoAcceptDue', () => {
    it('开关关闭 / 休息中 / 非营业时段均不自动接单', () => {
        expect(isAutoAcceptDue({ ...base, enabled: false })).toBe(false);
        expect(isAutoAcceptDue({ ...base, openNow: false })).toBe(false);
    });

    it('未到延迟秒数不接，到时即接（含 0 秒立即接）', () => {
        expect(isAutoAcceptDue({ ...base, elapsedMs: 29_999 })).toBe(false);
        expect(isAutoAcceptDue({ ...base, elapsedMs: 30_000 })).toBe(true);
        expect(isAutoAcceptDue({ ...base, delaySeconds: 0, elapsedMs: 0 })).toBe(true);
    });

    it('适用范围不含该路线时跳过', () => {
        expect(isAutoAcceptDue({ ...base, routes: ['R2', 'R3'] })).toBe(false);
        expect(isAutoAcceptDue({ ...base, route: 'R4' })).toBe(false);
    });

    it('每日上限：0 不限；达到上限退回人工', () => {
        expect(isAutoAcceptDue({ ...base, dailyLimit: 0, acceptedToday: 999 })).toBe(true);
        expect(isAutoAcceptDue({ ...base, dailyLimit: 20, acceptedToday: 19 })).toBe(true);
        expect(isAutoAcceptDue({ ...base, dailyLimit: 20, acceptedToday: 20 })).toBe(false);
    });
});

describe('canAutoAcceptStatus', () => {
    it('仅待商家接单可自动接', () => {
        expect(canAutoAcceptStatus('pending_merchant')).toBe(true);
        expect(canAutoAcceptStatus('accepted')).toBe(false);
        expect(canAutoAcceptStatus(null)).toBe(false);
    });
});
