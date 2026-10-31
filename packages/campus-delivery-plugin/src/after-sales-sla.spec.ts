import { describe, expect, it } from 'vitest';
import { businessDeadline } from './after-sales-sla';

const HOUR = 3_600_000;

describe('businessDeadline（§99 营业时段感知）', () => {
    it('未配置营业时间：按日历时间顺延', () => {
        const start = new Date('2026-10-01T12:00:00+08:00');
        expect(businessDeadline(start, 48, null)).toBe(start.getTime() + 48 * HOUR);
        expect(businessDeadline(start, 48, '营业中')).toBe(start.getTime() + 48 * HOUR);
    });

    it('只统计营业时段：10:00-22:00 的 48 营业小时跨 5 个自然日', () => {
        const start = new Date('2026-10-01T12:00:00+08:00');
        const got = businessDeadline(start, 48, '10:00-22:00');
        expect(new Date(got).toISOString()).toBe(new Date('2026-10-05T12:00:00+08:00').toISOString());
    });

    it('起点在非营业时段：从随后最近的开门时刻开始计时', () => {
        const start = new Date('2026-10-01T03:00:00+08:00');
        const got = businessDeadline(start, 2, '10:00-22:00');
        expect(new Date(got).toISOString()).toBe(new Date('2026-10-01T12:00:00+08:00').toISOString());
    });

    it('跨零点营业时段 18:00-02:00', () => {
        const start = new Date('2026-10-01T20:00:00+08:00');
        // 20:00 起 4 营业小时 → 次日 00:00（仍在同一营业段内）
        const got = businessDeadline(start, 4, '18:00-02:00');
        expect(new Date(got).toISOString()).toBe(new Date('2026-10-02T00:00:00+08:00').toISOString());
    });

    it('SLA 暂停时长线性顺延', () => {
        const start = new Date('2026-10-01T12:00:00+08:00');
        const base = businessDeadline(start, 10, '10:00-22:00');
        expect(businessDeadline(start, 10, '10:00-22:00', 2 * HOUR)).toBe(base + 2 * HOUR);
    });

    it('休业日整天跳过（§100）：48 营业小时遇到 1 天休业顺延 1 天', () => {
        const start = new Date('2026-10-01T12:00:00+08:00');
        const base = businessDeadline(start, 48, '10:00-22:00');
        const got = businessDeadline(start, 48, '10:00-22:00', 0, ['2026-10-03']);
        expect(got).toBe(base + 24 * HOUR);
    });

    it('未配置营业时间但有休业日：仍按休业日顺延', () => {
        const start = new Date('2026-10-01T12:00:00+08:00');
        const got = businessDeadline(start, 24, null, 0, ['2026-10-01']);
        expect(new Date(got).toISOString()).toBe(new Date('2026-10-03T00:00:00+08:00').toISOString());
    });

    it('无休业日时与原口径完全一致', () => {
        const start = new Date('2026-10-01T12:00:00+08:00');
        expect(businessDeadline(start, 48, '10:00-22:00', 0, [])).toBe(businessDeadline(start, 48, '10:00-22:00'));
    });
});
