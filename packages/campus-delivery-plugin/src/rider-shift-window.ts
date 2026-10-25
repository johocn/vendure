// 排班时段判断（纯函数，便于单测）：shiftDate 为校园时区 YYYY-MM-DD，start/end 为 HH:mm。
// 支持跨零点班次（如 22:00-02:00 记在开始日，次日 02:00 前仍有效）。

const CAMPUS_TZ_OFFSET_MINUTES = 480; // Asia/Shanghai（UTC+8），与后台排班口径一致

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** 按校园时区取日期键 YYYY-MM-DD */
export function localDateKey(at: Date, tzOffsetMinutes = CAMPUS_TZ_OFFSET_MINUTES): string {
    const d = new Date(at.getTime() + tzOffsetMinutes * 60_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 按校园时区取当天分钟数（0-1439） */
export function localMinutes(at: Date, tzOffsetMinutes = CAMPUS_TZ_OFFSET_MINUTES): number {
    const d = new Date(at.getTime() + tzOffsetMinutes * 60_000);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** HH:mm → 分钟数；非法返回 null */
export function parseHm(value?: string | null): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

/** 日期键偏移 n 天（跨月/跨年由 Date 处理） */
export function addDays(dateKey: string, n: number): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    const t = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1) + n * 86_400_000);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 当前时刻是否落在该排班时段内（跨零点按「开始日 + 次日结束」判定） */
export function shiftCoversNow(
    shift: { shiftDate: string; startTime: string; endTime: string },
    at: Date,
    tzOffsetMinutes = CAMPUS_TZ_OFFSET_MINUTES,
): boolean {
    const start = parseHm(shift.startTime);
    const end = parseHm(shift.endTime);
    if (start == null || end == null || start === end) return false;
    const today = localDateKey(at, tzOffsetMinutes);
    const now = localMinutes(at, tzOffsetMinutes);
    if (start < end) {
        return shift.shiftDate === today && now >= start && now < end;
    }
    // 跨零点：开始日 [start, 24:00) 或 次日 [00:00, end)
    if (shift.shiftDate === today) return now >= start;
    return shift.shiftDate === addDays(today, -1) && now < end;
}
