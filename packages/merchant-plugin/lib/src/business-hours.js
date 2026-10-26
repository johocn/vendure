"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TIMEZONE = void 0;
exports.parseBusinessHours = parseBusinessHours;
exports.isOpenAt = isOpenAt;
exports.formatBusinessHoursText = formatBusinessHoursText;
exports.DEFAULT_TIMEZONE = 'Asia/Shanghai';
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function pad2(n) {
    return String(n).padStart(2, '0');
}
/** 归一化 HH:mm（支持 9:00 这类不补零写法；24:00 视为当日结束） */
function normalizeTime(value) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value !== null && value !== void 0 ? value : '').trim());
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
function toMinutes(value) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value !== null && value !== void 0 ? value : '').trim());
    if (!m) {
        return null;
    }
    return Number(m[1]) * 60 + Number(m[2]);
}
function parsePeriodToken(token) {
    const m = /^(\d{1,2}:\d{2})\s*(?:-|~|—|至|到)\s*(\d{1,2}:\d{2})$/.exec(String(token !== null && token !== void 0 ? token : '').trim());
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
function parsePeriodsFromText(value) {
    if (!value) {
        return [];
    }
    return String(value)
        .split(/[,，、;；]+/)
        .map(token => parsePeriodToken(token))
        .filter((p) => p != null);
}
function normalizePeriods(list) {
    if (!Array.isArray(list)) {
        return [];
    }
    const periods = [];
    for (const item of list) {
        const start = normalizeTime(item === null || item === void 0 ? void 0 : item.start);
        const end = normalizeTime(item === null || item === void 0 ? void 0 : item.end);
        if (start && end) {
            periods.push({ start, end });
        }
    }
    return periods;
}
function normalizeWeekly(list) {
    if (!Array.isArray(list)) {
        return [];
    }
    const days = [];
    for (const item of list) {
        const day = Number(item === null || item === void 0 ? void 0 : item.day);
        if (!Number.isInteger(day) || day < 0 || day > 6) {
            continue;
        }
        const entry = { day, periods: normalizePeriods(item === null || item === void 0 ? void 0 : item.periods) };
        if ((item === null || item === void 0 ? void 0 : item.closed) === true) {
            entry.closed = true;
        }
        days.push(entry);
    }
    return days.sort((a, b) => a.day - b.day);
}
function normalizeSpecialDates(list) {
    var _a;
    if (!Array.isArray(list)) {
        return [];
    }
    const out = [];
    for (const item of list) {
        const date = String((_a = item === null || item === void 0 ? void 0 : item.date) !== null && _a !== void 0 ? _a : '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            continue;
        }
        const entry = { date };
        if ((item === null || item === void 0 ? void 0 : item.closed) === true) {
            entry.closed = true;
        }
        if (Array.isArray(item === null || item === void 0 ? void 0 : item.periods)) {
            entry.periods = normalizePeriods(item === null || item === void 0 ? void 0 : item.periods);
        }
        if (typeof (item === null || item === void 0 ? void 0 : item.note) === 'string') {
            entry.note = item.note;
        }
        out.push(entry);
    }
    return out;
}
/** 把任意形态的 raw 归一化为结构化营业时间（不解析纯文本时段） */
function normalizeStructured(raw) {
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
        }
        catch (_a) {
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
    const obj = raw;
    const result = {};
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
function parseBusinessHours(raw, text) {
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
    return Object.assign(Object.assign({}, structured), { weekly: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, periods: periods.map(p => (Object.assign({}, p))) })) });
}
function matchPeriod(period, minutes) {
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
function matchPeriods(periods, minutes) {
    return (periods !== null && periods !== void 0 ? periods : []).some(period => matchPeriod(period, minutes));
}
/** 按指定时区求当地星期、日期串与当日分钟数 */
function getZonedParts(date, timeZone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZone || exports.DEFAULT_TIMEZONE,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short',
        });
        const parts = formatter.formatToParts(date);
        const get = (type) => { var _a, _b; return (_b = (_a = parts.find(p => p.type === type)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : ''; };
        const weekdayKey = get('weekday');
        const weekdayIndex = WEEKDAY_KEYS.indexOf(weekdayKey);
        const hour = Number(get('hour')) % 24;
        const minute = Number(get('minute'));
        return {
            weekday: weekdayIndex >= 0 ? weekdayIndex : date.getUTCDay(),
            dateKey: `${get('year')}-${get('month')}-${get('day')}`,
            minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
        };
    }
    catch (_a) {
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
function isOpenAt(source, at = new Date()) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const hours = parseBusinessHours(source.businessHours, source.businessHoursText);
    const hasConfig = ((_b = (_a = hours.weekly) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0 || ((_d = (_c = hours.specialDates) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0) > 0;
    if (!hasConfig) {
        return true;
    }
    const { weekday, dateKey, minutes } = getZonedParts(at, source.timezone || exports.DEFAULT_TIMEZONE);
    const special = (_e = hours.specialDates) === null || _e === void 0 ? void 0 : _e.find(item => item.date === dateKey);
    if (special) {
        if (special.closed === true) {
            return false;
        }
        if (((_g = (_f = special.periods) === null || _f === void 0 ? void 0 : _f.length) !== null && _g !== void 0 ? _g : 0) > 0) {
            return matchPeriods(special.periods, minutes);
        }
    }
    const dayConfig = (_h = hours.weekly) === null || _h === void 0 ? void 0 : _h.find(item => item.day === weekday);
    if (!dayConfig) {
        return false;
    }
    if (dayConfig.closed === true) {
        return false;
    }
    return matchPeriods(dayConfig.periods, minutes);
}
function periodSignature(day) {
    var _a, _b;
    if (day.closed === true || ((_b = (_a = day.periods) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) === 0) {
        return '';
    }
    return day.periods.map(p => `${p.start}-${p.end}`).join(',');
}
/** 生成营业时间展示文案；无法解析时返回 fallback */
function formatBusinessHoursText(raw, fallback) {
    var _a;
    const hours = parseBusinessHours(raw, null);
    const weekly = [...((_a = hours.weekly) !== null && _a !== void 0 ? _a : [])].sort((a, b) => a.day - b.day);
    if (weekly.length === 0) {
        return fallback !== null && fallback !== void 0 ? fallback : '';
    }
    const signatures = weekly.map(day => periodSignature(day));
    const uniform = signatures.every(sig => sig === signatures[0]);
    if (uniform) {
        return signatures[0] || (fallback !== null && fallback !== void 0 ? fallback : '');
    }
    return weekly
        .map(day => `${WEEKDAY_LABELS[day.day]} ${periodSignature(day) || '休息'}`)
        .join('; ');
}
//# sourceMappingURL=business-hours.js.map