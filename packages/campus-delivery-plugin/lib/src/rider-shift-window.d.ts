/** 按校园时区取日期键 YYYY-MM-DD */
export declare function localDateKey(at: Date, tzOffsetMinutes?: number): string;
/** 按校园时区取当天分钟数（0-1439） */
export declare function localMinutes(at: Date, tzOffsetMinutes?: number): number;
/** HH:mm → 分钟数；非法返回 null */
export declare function parseHm(value?: string | null): number | null;
/** 日期键偏移 n 天（跨月/跨年由 Date 处理） */
export declare function addDays(dateKey: string, n: number): string;
/** 当前时刻是否落在该排班时段内（跨零点按「开始日 + 次日结束」判定） */
export declare function shiftCoversNow(shift: {
    shiftDate: string;
    startTime: string;
    endTime: string;
}, at: Date, tzOffsetMinutes?: number): boolean;
