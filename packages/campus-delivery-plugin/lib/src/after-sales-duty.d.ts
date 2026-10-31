export interface DutyEntry {
    /** 0=周日 .. 6=周六 */
    weekday: number;
    /** 当日起始分钟（0-1439） */
    startMin: number;
    /** 当日结束分钟（0-1440；跨零点可 > 1440） */
    endMin: number;
    userId: number;
}
/**
 * 当前值班人；无人值班返回 null。
 * 命中规则：同一自然日区间内，或前一日跨零点区间延伸至当日凌晨。
 */
export declare function dutyAssigneeAt(entries: DutyEntry[] | null | undefined, nowMs: number): number | null;
/** 归一化值班条目（写入用）：非法条目抛错，由调用方转 UserInputError */
export declare function normalizeDutyEntries(raw: unknown): DutyEntry[];
