interface Range {
    start: number;
    end: number;
}
export declare function parseBusinessHours(raw?: string | null): Range[];
/** 校园时区当前分钟数（0-1439） */
export declare function campusNowMinutes(now?: number): number;
/** 是否在营业时段内：未配置营业时间视为营业（不误伤存量店铺） */
export declare function isWithinBusinessHours(raw: string | null | undefined, now?: number): boolean;
export {};
