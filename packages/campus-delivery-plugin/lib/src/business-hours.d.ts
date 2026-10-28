interface Range {
    start: number;
    end: number;
}
export declare function parseBusinessHours(raw?: string | null): Range[];
/** 校园时区当前分钟数（0-1439） */
export declare function campusNowMinutes(now?: number): number;
/** 是否在营业时段内：未配置营业时间视为营业（不误伤存量店铺） */
export declare function isWithinBusinessHours(raw: string | null | undefined, now?: number): boolean;
/** 下一次营业状态切换（自动开门 / 自动打烊），供商家端倒计时与打烊前提醒使用 */
export interface BusinessTransition {
    /** open=到点自动开门，close=到点自动打烊 */
    action: 'open' | 'close';
    /** 切换时刻 "HH:mm" */
    at: string;
    /** 距切换还有多少分钟（>=1） */
    inMinutes: number;
    /** 切换发生在今天（false=明天） */
    today: boolean;
}
/**
 * 下一次切换点：取所有时段起点/终点中「严格晚于当前分钟」的最近一个。
 * 未配置营业时间 → null（全天营业，无自动切换）。
 */
export declare function nextBusinessTransition(raw: string | null | undefined, now?: number): BusinessTransition | null;
export {};
