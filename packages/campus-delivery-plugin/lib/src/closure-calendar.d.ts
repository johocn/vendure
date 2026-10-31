export interface ClosureDate {
    /** 休业日期 YYYY-MM-DD（校园时区自然日） */
    date: string;
    /** 备注（如「国庆假期」），空为 null */
    note: string | null;
}
/** 最多登记条数：防误导入把配置撑爆（simple-json 列） */
export declare const MAX_CLOSURE_ENTRIES = 30;
/** 最远可提前多少天登记 */
export declare const CLOSURE_HORIZON_DAYS = 90;
/** 备注长度上限 */
export declare const CLOSURE_NOTE_MAX = 40;
/** 今天（校园时区） */
export declare function campusToday(now?: number): string;
/**
 * 严格归一化（写入用）：非法条目抛错（由调用方转 UserInputError），
 * 同日期后者覆盖，按日期升序返回。
 */
export declare function normalizeClosureDates(raw: unknown, now?: number): ClosureDate[];
/**
 * 宽松读取（判定/展示用）：忽略脏条目与已过去的日期，不抛错。
 * 存量行可能被手动改过，读取路径绝不能因一条脏数据让整店营业状态判定失败。
 */
export declare function safeClosureDates(raw: unknown, now?: number): ClosureDate[];
/** 今日休业条目；null = 今日正常营业（不受日历影响） */
export declare function closedToday(dates: ClosureDate[] | null | undefined, now?: number): ClosureDate | null;
/**
 * SLA 口径（§100）：取配置中全部合法休业日期（含已过去的日期）。
 * safeClosureDates 会丢弃过去日期（面向「今日营业状态」），但售后 SLA 重算需要覆盖
 * 申请时点至今的历史休业日，否则跨假期的工单会被误判超时。
 */
export declare function closureDateKeys(raw: unknown): string[];
/** 下一次休业（今天或未来最近一条），供后台/C 端提示 */
export declare function nextClosure(dates: ClosureDate[] | null | undefined, now?: number): ClosureDate | null;
