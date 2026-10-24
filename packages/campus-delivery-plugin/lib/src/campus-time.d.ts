/**
 * 校园业务时区固定 UTC+8（无夏令时）。
 * 统计日界/小时桶不随部署机器时区漂移（服务器切 UTC 后「今日」不再偏移 8 小时）。
 */
export declare const CAMPUS_TZ_OFFSET_MS: number;
/** 时间戳所在「校园自然日」的 0 点（返回 epoch ms） */
export declare function startOfCampusDay(t: number): number;
/** 时间戳所在校园小时（0-23） */
export declare function campusHour(t: number): number;
/** 时间戳所在校园自然日 key：YYYY-MM-DD */
export declare function campusDayKey(t: number): string;
