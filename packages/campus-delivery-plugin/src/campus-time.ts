/**
 * 校园业务时区固定 UTC+8（无夏令时）。
 * 统计日界/小时桶不随部署机器时区漂移（服务器切 UTC 后「今日」不再偏移 8 小时）。
 */
export const CAMPUS_TZ_OFFSET_MS = 8 * 3600_000;
const DAY_MS = 24 * 3600_000;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** 时间戳所在「校园自然日」的 0 点（返回 epoch ms） */
export function startOfCampusDay(t: number): number {
    const shifted = t + CAMPUS_TZ_OFFSET_MS;
    return shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS) - CAMPUS_TZ_OFFSET_MS;
}

/** 时间戳所在校园小时（0-23） */
export function campusHour(t: number): number {
    return new Date(t + CAMPUS_TZ_OFFSET_MS).getUTCHours();
}

/** 时间戳所在校园自然日 key：YYYY-MM-DD */
export function campusDayKey(t: number): string {
    const d = new Date(t + CAMPUS_TZ_OFFSET_MS);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
