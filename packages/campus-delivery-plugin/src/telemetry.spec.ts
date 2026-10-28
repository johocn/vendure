import { describe, expect, it } from 'vitest';
import {
    buildTrend,
    normalizeTrackEventBatch,
    rowsToDayCounts,
    sanitizeErrorReport,
    sanitizeTrackEvent,
    TRACK_BATCH_MAX,
    TRACK_EVENT_NAME_MAX,
    TRACK_PROPS_MAX_CHARS,
} from './telemetry';

/** 构造校园时刻（UTC+8） */
const atCampus = (d: number, h: number, m: number) => Date.UTC(2026, 9, d, h - 8, m);

describe('sanitizeTrackEvent', () => {
    it('无事件名直接丢弃', () => {
        expect(sanitizeTrackEvent({ page: '/pages/home/index' })).toBeNull();
        expect(sanitizeTrackEvent({ eventName: '   ' })).toBeNull();
    });

    it('裁剪超长字段并归一空白值', () => {
        const ev = sanitizeTrackEvent({
            eventName: 'x'.repeat(TRACK_EVENT_NAME_MAX + 20),
            page: '   ',
            sessionId: 's1',
            props: { a: 1 },
        });
        expect(ev?.eventName.length).toBe(TRACK_EVENT_NAME_MAX);
        expect(ev?.page).toBeNull();
        expect(ev?.props).toEqual({ a: 1 });
    });

    it('非法 props 字符串置空，超限 props 标记截断', () => {
        expect(sanitizeTrackEvent({ eventName: 'e', props: '{bad json' })?.props).toBeNull();
        const huge = sanitizeTrackEvent({ eventName: 'e', props: { big: 'y'.repeat(TRACK_PROPS_MAX_CHARS + 100) } });
        expect(huge?.props?._truncated).toBe(true);
        expect(String(huge?.props?.raw).length).toBe(TRACK_PROPS_MAX_CHARS);
    });
});

describe('normalizeTrackEventBatch', () => {
    it('批内去重（同事件名+页面+会话+属性只留一条）', () => {
        const rows = normalizeTrackEventBatch({
            events: [
                { eventName: 'page_view', page: '/home', sessionId: 's' },
                { eventName: 'page_view', page: '/home', sessionId: 's' },
                { eventName: 'page_view', page: '/detail', sessionId: 's' },
                { eventName: '' },
            ],
        });
        expect(rows.map(r => r.page)).toEqual(['/home', '/detail']);
    });

    it('批量上限截断', () => {
        const events = Array.from({ length: TRACK_BATCH_MAX + 10 }, (_, i) => ({ eventName: `e${i}` }));
        expect(normalizeTrackEventBatch({ events })).toHaveLength(TRACK_BATCH_MAX);
    });

    it('非数组入参返回空数组', () => {
        expect(normalizeTrackEventBatch(undefined)).toEqual([]);
        expect(normalizeTrackEventBatch({ events: 'oops' })).toEqual([]);
    });
});

describe('sanitizeErrorReport', () => {
    it('message 缺失丢弃，source/level 归一', () => {
        expect(sanitizeErrorReport({})).toBeNull();
        const r = sanitizeErrorReport({ message: 'boom', source: 'ADMIN', level: 'WARN', url: 'https://a/b' });
        expect(r).toMatchObject({ message: 'boom', source: 'admin', level: 'warn', url: 'https://a/b' });
        expect(sanitizeErrorReport({ message: 'x' })?.source).toBe('c-end');
        expect(sanitizeErrorReport({ message: 'x', level: 'fatal' })?.level).toBe('error');
    });
});

describe('rowsToDayCounts', () => {
    it('SQL 分组结果转计数表，脏行跳过', () => {
        expect(
            rowsToDayCounts([
                { day: '2026-10-26', cnt: 3 },
                { day: '2026-10-27T00:00:00', cnt: '5' },
                { day: '', cnt: 9 },
            ]),
        ).toEqual({ '2026-10-26': 3, '2026-10-27': 5 });
        expect(rowsToDayCounts(undefined)).toEqual({});
    });
});

describe('buildTrend', () => {
    it('固定 7 天、按校园自然日由旧到新、缺日补 0', () => {
        const now = atCampus(28, 10, 0);
        const trend = buildTrend(7, now, { '2026-10-28': 12, '2026-10-26': 4 }, { '2026-10-28': 2 });
        expect(trend).toHaveLength(7);
        expect(trend[0].date).toBe('2026-10-22');
        expect(trend[6]).toEqual({ date: '2026-10-28', events: 12, errors: 2 });
        expect(trend[4]).toEqual({ date: '2026-10-26', events: 4, errors: 0 });
        expect(trend[5]).toEqual({ date: '2026-10-27', events: 0, errors: 0 });
    });

    it('跨零点按 UTC+8 归日（UTC 17:00 = 次日夜 01:00）', () => {
        const now = Date.UTC(2026, 9, 27, 17, 30); // 校园时间 2026-10-28 01:30
        const trend = buildTrend(2, now, { '2026-10-28': 1 }, {});
        expect(trend.map(p => p.date)).toEqual(['2026-10-27', '2026-10-28']);
    });
});
