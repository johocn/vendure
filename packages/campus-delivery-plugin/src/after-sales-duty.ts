/**
 * 售后值班排班（§100）：按校园时区（UTC+8）的星期与分钟区间解析当前值班人。
 * weekday 0=周日 .. 6=周六；startMin/endMin 为当日 0 点起的分钟数，
 * endMin <= startMin 视为跨零点（如 22:00-02:00 → 1320-1560），需展开前一天。
 */
import { CAMPUS_TZ_OFFSET_MS } from './campus-time';

const DAY_MINUTES = 1440;
const MINUTE_MS = 60_000;
/** 1970-01-01（epoch 0）为周四 */
const EPOCH_WEEKDAY = 4;

export interface DutyEntry {
    /** 0=周日 .. 6=周六 */
    weekday: number;
    /** 当日起始分钟（0-1439） */
    startMin: number;
    /** 当日结束分钟（0-1440；跨零点可 > 1440） */
    endMin: number;
    userId: number;
}

/** 校园自然日索引 → 星期（0=周日） */
function weekdayOfDayIndex(dayIdx: number): number {
    return (((dayIdx + EPOCH_WEEKDAY) % 7) + 7) % 7;
}

/**
 * 当前值班人；无人值班返回 null。
 * 命中规则：同一自然日区间内，或前一日跨零点区间延伸至当日凌晨。
 */
export function dutyAssigneeAt(entries: DutyEntry[] | null | undefined, nowMs: number): number | null {
    if (!entries || !entries.length) return null;
    const campusMin = Math.floor((nowMs + CAMPUS_TZ_OFFSET_MS) / MINUTE_MS);
    const dayIdx = Math.floor(campusMin / DAY_MINUTES);
    const minuteOfDay = campusMin - dayIdx * DAY_MINUTES;
    const weekday = weekdayOfDayIndex(dayIdx);
    for (const entry of entries) {
        const wd = Number(entry?.weekday);
        const start = Number(entry?.startMin);
        let end = Number(entry?.endMin);
        const userId = Number(entry?.userId);
        if (!Number.isFinite(wd) || !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(userId)) continue;
        if (end <= start) end += DAY_MINUTES; // 跨零点
        // 当日区间
        if (wd === weekday && minuteOfDay >= start && minuteOfDay < end) return userId || null;
        // 前一日跨零点区间延伸至今晨
        if (((wd + 1) % 7) === weekday && end > DAY_MINUTES) {
            if (minuteOfDay < end - DAY_MINUTES) return userId || null;
        }
    }
    return null;
}

/** 归一化值班条目（写入用）：非法条目抛错，由调用方转 UserInputError */
export function normalizeDutyEntries(raw: unknown): DutyEntry[] {
    if (raw == null) return [];
    if (!Array.isArray(raw)) throw new Error('值班表必须是条目数组');
    const out: DutyEntry[] = [];
    for (const item of raw) {
        const weekday = Number((item as any)?.weekday);
        const startMin = Number((item as any)?.startMin);
        const endMin = Number((item as any)?.endMin);
        const userId = Number((item as any)?.userId);
        if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('值班星期必须是 0-6（0=周日）');
        if (!Number.isInteger(startMin) || startMin < 0 || startMin >= DAY_MINUTES) throw new Error('值班开始时间不合法（0-1439 分钟）');
        if (!Number.isInteger(endMin) || endMin < 0 || endMin > DAY_MINUTES + DAY_MINUTES) throw new Error('值班结束时间不合法');
        if (!Number.isInteger(userId) || userId <= 0) throw new Error('值班人必须是本店管理员');
        out.push({ weekday, startMin, endMin, userId });
    }
    return out;
}
