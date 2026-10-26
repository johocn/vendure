/**
 * 营业时间纯函数：结构化营业时间解析、当前是否营业判定、文案格式化。
 *
 * 设计约定：
 *  - 结构化数据优先（weekly / specialDates），解析失败才回退解析 `businessHoursText`；
 *  - 文本兼容 "09:00-21:00" 与 "09:00-12:00,13:00-18:00" 两种常见写法，解析后生成
 *    周一到周日同值的 weekly（day 取值 0=周日 … 6=周六，与 Date#getDay 一致）；
 *  - 判定使用 Intl.DateTimeFormat + timeZone 取当地星期与分钟数，不依赖运行机器时区；
 *  - 支持 end < start 的跨天时段、特殊日期（优先于每周）与每周固定闭店。
 */

export interface BusinessPeriod {
    /** HH:mm */
    start: string;
    /** HH:mm */
    end: string;
}

export interface BusinessDay {
    /** 0=周日 … 6=周六 */
    day: number;
    periods: BusinessPeriod[];
    closed?: boolean;
}

export interface SpecialDate {
    /** YYYY-MM-DD（门店当地日期） */
    date: string;
    closed?: boolean;
    periods?: BusinessPeriod[];
    note?: string;
}

export interface StructuredBusinessHours {
    weekly?: BusinessDay[];
    specialDates?: SpecialDate[];
    crossMidnight?: boolean;
}

/** 营业时间来源：门店实体相关字段的超集 */
export interface BusinessHoursSource {
    businessHours?: StructuredBusinessHours | string | null;
    businessHoursText?: string | null;
    timezone?: string | null;
}

export const DEFAULT_TIMEZONE = 'Asia/Shanghai';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** 归一化 HH:mm（支持 9:00 这类不补零写法；24:00 视为当日结束） */
function normalizeTime(value: string): string | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
    if (!m) {
        return null;
    }
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) {
        return null;
    }
    if (hour > 24 || (hour === 24 && minute !== 0)) {
        return null;
    }
    return `${pad2(hour)}:${m[2]}`;
}

function toMinutes(value: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
    if (!m) {
        return null;
    }
    return Number(m[1]) * 60 + Number(m[2]);
}

function parsePeriodToken(token: string): BusinessPeriod | null {
    const m = /^(\d{1,2}:\d{2})\s*(?:-|~|—|至|到)\s*(\d{1,2}:\d{2})$/.exec(String(token ?? '').trim());
    if (!m) {
        return null;
    }
    const start = normalizeTime(m[1]);
    const end = normalizeTime(m[2]);
    if (!start || !end) {
        return null;
    }
    return { start, end };
}

/** 解析 "09:00-12:00,13:00-18:00" 这类文本（逗号/顿号/分号分隔多时段） */
function parsePeriodsFromText(value: string | null | undefined): BusinessPeriod[] {
    if (!value) {
        return [];
    }
    return String(value)
        .split(/[,，、;；]+/)
        .map(token => parsePeriodToken(token))
        .filter((p): p is BusinessPeriod => p != null);
}

function normalizePeriods(list: unknown): BusinessPeriod[] {
    if (!Array.isArray(list)) {
        return [];
    }
    const periods: BusinessPeriod[] = [];
    for (const item of list) {
        const start = normalizeTime((item as any)?.start);
        const end = normalizeTime((item as any)?.end);
        if (start && end) {
            periods.push({ start, end });
        }
    }
    return periods;
}

function normalizeWeekly(list: unknown): BusinessDay[] {
    if (!Array.isArray(list)) {
        return [];
    }
    const days: BusinessDay[] = [];
    for (const item of list) {
        const day = Number((item as any)?.day);
        if (!Number.isInteger(day) || day < 0 || day > 6) {
            continue;
        }
        const entry: BusinessDay = { day, periods: normalizePeriods((item as any)?.periods) };
        if ((item as any)?.closed === true) {
            entry.closed = true;
        }
        days.push(entry);
    }
    return days.sort((a, b) => a.day - b.day);
}

function normalizeSpecialDates(list: unknown): SpecialDate[] {
    if (!Array.isArray(list)) {
        return [];
    }
    const out: SpecialDate[] = [];
    for (const item of list) {
        const date = String((item as any)?.date ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            continue;
        }
        const entry: SpecialDate = { date };
        if ((item as any)?.closed === true) {
            entry.closed = true;
        }
        if (Array.isArray((item as any)?.periods)) {
            entry.periods = normalizePeriods((item as any)?.periods);
        }
        if (typeof (item as any)?.note === 'string') {
            entry.note = (item as any).note;
        }
        out.push(entry);
    }
    return out;
}

/** 把任意形态的 raw 归一化为结构化营业时间（不解析纯文本时段） */
function normalizeStructured(raw: unknown): StructuredBusinessHours {
    if (raw == null) {
        return {};
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            return {};
        }
        try {
            return normalizeStructured(JSON.parse(trimmed));
        } catch {
            return {};
        }
    }
    if (Array.isArray(raw)) {
        const weekly = normalizeWeekly(raw);
        return weekly.length > 0 ? { weekly } : {};
    }
    if (typeof raw !== 'object') {
        return {};
    }
    const obj = raw as Record<string, unknown>;
    const result: StructuredBusinessHours = {};
    const weekly = normalizeWeekly(obj.weekly);
    if (weekly.length > 0) {
        result.weekly = weekly;
    }
    const specialDates = normalizeSpecialDates(obj.specialDates);
    if (specialDates.length > 0) {
        result.specialDates = specialDates;
    }
    if (typeof obj.crossMidnight === 'boolean') {
        result.crossMidnight = obj.crossMidnight;
    }
    return result;
}

/**
 * 解析营业时间：结构化优先；结构化无有效数据时回退解析 raw / text 中的时段文本，
 * 并生成「周一至周日同值」的 weekly。
 */
export function parseBusinessHours(
    raw: StructuredBusinessHours | string | null | undefined,
    text?: string | null,
): StructuredBusinessHours {
    const structured = normalizeStructured(raw);
    if (structured.weekly || structured.specialDates) {
        return structured;
    }
    let periods = parsePeriodsFromText(typeof raw === 'string' ? raw : null);
    if (periods.length === 0) {
        periods = parsePeriodsFromText(text);
    }
    if (periods.length === 0) {
        return structured;
    }
    return {
        ...structured,
        weekly: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, periods: periods.map(p => ({ ...p })) })),
    };
}

function matchPeriod(period: BusinessPeriod, minutes: number): boolean {
    const start = toMinutes(period.start);
    const end = toMinutes(period.end);
    if (start == null || end == null) {
        return false;
    }
    // 起止相同视为全天营业（等价 24 小时）
    if (start === end) {
        return true;
    }
    if (end > start) {
        return minutes >= start && minutes < end;
    }
    // 跨天：如 18:00-02:00
    return minutes >= start || minutes < end;
}

function matchPeriods(periods: BusinessPeriod[] | undefined, minutes: number): boolean {
    return (periods ?? []).some(period => matchPeriod(period, minutes));
}

interface ZonedParts {
    weekday: number;
    dateKey: string;
    minutes: number;
}

/** 按指定时区求当地星期、日期串与当日分钟数 */
function getZonedParts(date: Date, timeZone: string): ZonedParts {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZone || DEFAULT_TIMEZONE,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short',
        });
        const parts = formatter.formatToParts(date);
        const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
        const weekdayKey = get('weekday');
        const weekdayIndex = WEEKDAY_KEYS.indexOf(weekdayKey);
        const hour = Number(get('hour')) % 24;
        const minute = Number(get('minute'));
        return {
            weekday: weekdayIndex >= 0 ? weekdayIndex : date.getUTCDay(),
            dateKey: `${get('year')}-${get('month')}-${get('day')}`,
            minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
        };
    } catch {
        // 非法时区兜底到运行环境本地时间
        return {
            weekday: date.getDay(),
            dateKey: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
            minutes: date.getHours() * 60 + date.getMinutes(),
        };
    }
}

/**
 * 判断给定时间门店是否营业。
 * - specialDates 命中时优先：closed → 不营业；有 periods → 按该日时段判定；
 * - 否则回退 weekly：未配置该星期 → 不营业；closed → 不营业；
 * - 完全未配置营业时间（weekly 与 specialDates 都为空）→ 视为营业（不阻断业务）。
 */
export function isOpenAt(source: BusinessHoursSource, at: Date = new Date()): boolean {
    const hours = parseBusinessHours(source.businessHours, source.businessHoursText);
    const hasConfig = (hours.weekly?.length ?? 0) > 0 || (hours.specialDates?.length ?? 0) > 0;
    if (!hasConfig) {
        return true;
    }

    const { weekday, dateKey, minutes } = getZonedParts(at, source.timezone || DEFAULT_TIMEZONE);

    const special = hours.specialDates?.find(item => item.date === dateKey);
    if (special) {
        if (special.closed === true) {
            return false;
        }
        if ((special.periods?.length ?? 0) > 0) {
            return matchPeriods(special.periods, minutes);
        }
    }

    const dayConfig = hours.weekly?.find(item => item.day === weekday);
    if (!dayConfig) {
        return false;
    }
    if (dayConfig.closed === true) {
        return false;
    }
    return matchPeriods(dayConfig.periods, minutes);
}

function periodSignature(day: BusinessDay): string {
    if (day.closed === true || (day.periods?.length ?? 0) === 0) {
        return '';
    }
    return day.periods.map(p => `${p.start}-${p.end}`).join(',');
}

/** 生成营业时间展示文案；无法解析时返回 fallback */
export function formatBusinessHoursText(
    raw: StructuredBusinessHours | string | null | undefined,
    fallback?: string | null,
): string {
    const hours = parseBusinessHours(raw, null);
    const weekly = [...(hours.weekly ?? [])].sort((a, b) => a.day - b.day);
    if (weekly.length === 0) {
        return fallback ?? '';
    }
    const signatures = weekly.map(day => periodSignature(day));
    const uniform = signatures.every(sig => sig === signatures[0]);
    if (uniform) {
        return signatures[0] || (fallback ?? '');
    }
    return weekly
        .map(day => `${WEEKDAY_LABELS[day.day]} ${periodSignature(day) || '休息'}`)
        .join('; ');
}
