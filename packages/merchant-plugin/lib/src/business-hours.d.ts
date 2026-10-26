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
export declare const DEFAULT_TIMEZONE = "Asia/Shanghai";
/**
 * 解析营业时间：结构化优先；结构化无有效数据时回退解析 raw / text 中的时段文本，
 * 并生成「周一至周日同值」的 weekly。
 */
export declare function parseBusinessHours(raw: StructuredBusinessHours | string | null | undefined, text?: string | null): StructuredBusinessHours;
/**
 * 判断给定时间门店是否营业。
 * - specialDates 命中时优先：closed → 不营业；有 periods → 按该日时段判定；
 * - 否则回退 weekly：未配置该星期 → 不营业；closed → 不营业；
 * - 完全未配置营业时间（weekly 与 specialDates 都为空）→ 视为营业（不阻断业务）。
 */
export declare function isOpenAt(source: BusinessHoursSource, at?: Date): boolean;
/** 生成营业时间展示文案；无法解析时返回 fallback */
export declare function formatBusinessHoursText(raw: StructuredBusinessHours | string | null | undefined, fallback?: string | null): string;
