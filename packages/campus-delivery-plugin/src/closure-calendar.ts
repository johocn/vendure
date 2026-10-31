/**
 * 营业日历：指定日期休业（§70）。
 * 商家可预先登记节假日/临时休业日期（如国庆休 3 天），当天 C 端展示「今日休业」并禁止下单，
 * 次日自动恢复（无需人工操作）。与营业时间（Channel.waimaiBusinessHours）、临时休息（cfg.paused）互补：
 *   可下单 = 在营业时段内 && 未临时休息 && 今日不在休业日历中。
 * 日期按校园时区 UTC+8 的自然日（campusDayKey），与统计日界同口径。
 */
import { CAMPUS_TZ_OFFSET_MS, campusDayKey, startOfCampusDay } from './campus-time';

export interface ClosureDate {
    /** 休业日期 YYYY-MM-DD（校园时区自然日） */
    date: string;
    /** 备注（如「国庆假期」），空为 null */
    note: string | null;
}

/** 最多登记条数：防误导入把配置撑爆（simple-json 列） */
export const MAX_CLOSURE_ENTRIES = 30;
/** 最远可提前多少天登记 */
export const CLOSURE_HORIZON_DAYS = 90;
/** 备注长度上限 */
export const CLOSURE_NOTE_MAX = 40;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 3600_000;

/** 严格校验日期：格式 + 真实存在（排除 2026-02-30 这类被 Date 归一化的假日期） */
function isValidDate(text: string): boolean {
    if (!DATE_RE.test(text)) return false;
    const t = Date.parse(`${text}T00:00:00+08:00`);
    if (!Number.isFinite(t)) return false;
    return new Date(t + CAMPUS_TZ_OFFSET_MS).toISOString().slice(0, 10) === text;
}

/** 今天（校园时区） */
export function campusToday(now: number = Date.now()): string {
    return campusDayKey(now);
}

/**
 * 严格归一化（写入用）：非法条目抛错（由调用方转 UserInputError），
 * 同日期后者覆盖，按日期升序返回。
 */
export function normalizeClosureDates(raw: unknown, now: number = Date.now()): ClosureDate[] {
    if (raw == null) return [];
    if (!Array.isArray(raw)) throw new Error('休业日历必须是日期数组');
    const today = campusToday(now);
    const horizon = campusDayKey(startOfCampusDay(now) + CLOSURE_HORIZON_DAYS * DAY_MS);
    const byDate = new Map<string, string | null>();
    for (const item of raw) {
        const date = String((item as any)?.date ?? '').trim();
        if (!isValidDate(date)) throw new Error(`休业日期格式不合法：「${date || '空'}」（需 YYYY-MM-DD）`);
        if (date < today) throw new Error(`休业日期不能早于今天：${date}`);
        if (date > horizon) throw new Error(`休业日期最多提前 ${CLOSURE_HORIZON_DAYS} 天：${date}`);
        const note = String((item as any)?.note ?? '').trim();
        if (note.length > CLOSURE_NOTE_MAX) throw new Error(`休业备注不能超过 ${CLOSURE_NOTE_MAX} 字符`);
        byDate.set(date, note || null);
    }
    if (byDate.size > MAX_CLOSURE_ENTRIES) throw new Error(`休业日期最多登记 ${MAX_CLOSURE_ENTRIES} 条`);
    return [...byDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, note]) => ({ date, note }));
}

/**
 * 宽松读取（判定/展示用）：忽略脏条目与已过去的日期，不抛错。
 * 存量行可能被手动改过，读取路径绝不能因一条脏数据让整店营业状态判定失败。
 */
export function safeClosureDates(raw: unknown, now: number = Date.now()): ClosureDate[] {
    let list: unknown = raw;
    if (typeof raw === 'string') {
        try {
            list = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(list)) return [];
    const today = campusToday(now);
    const byDate = new Map<string, string | null>();
    for (const item of list) {
        const date = String((item as any)?.date ?? '').trim();
        if (!isValidDate(date) || date < today) continue;
        const note = String((item as any)?.note ?? '').trim();
        byDate.set(date, note ? note.slice(0, CLOSURE_NOTE_MAX) : null);
    }
    return [...byDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, note]) => ({ date, note }));
}

/** 今日休业条目；null = 今日正常营业（不受日历影响） */
export function closedToday(dates: ClosureDate[] | null | undefined, now: number = Date.now()): ClosureDate | null {
    const today = campusToday(now);
    return (dates ?? []).find(d => d.date === today) ?? null;
}

/**
 * SLA 口径（§100）：取配置中全部合法休业日期（含已过去的日期）。
 * safeClosureDates 会丢弃过去日期（面向「今日营业状态」），但售后 SLA 重算需要覆盖
 * 申请时点至今的历史休业日，否则跨假期的工单会被误判超时。
 */
export function closureDateKeys(raw: unknown): string[] {
    let list: unknown = raw;
    if (typeof raw === 'string') {
        try {
            list = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(list)) return [];
    const out: string[] = [];
    for (const item of list) {
        const date = String((item as any)?.date ?? '').trim();
        if (isValidDate(date)) out.push(date);
    }
    return out;
}

/** 下一次休业（今天或未来最近一条），供后台/C 端提示 */
export function nextClosure(dates: ClosureDate[] | null | undefined, now: number = Date.now()): ClosureDate | null {
    const today = campusToday(now);
    return (dates ?? []).find(d => d.date >= today) ?? null;
}
