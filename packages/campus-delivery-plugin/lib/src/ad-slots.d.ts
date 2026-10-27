export interface AdSlotDef {
    code: string;
    name: string;
    /** 单日单价（分） */
    unitPriceFen: number;
}
export declare const AD_SLOTS: AdSlotDef[];
export declare const AD_SLOT_CODES: string[];
export declare function findAdSlot(code: string): AdSlotDef;
/** 校验并归一 YYYY-MM-DD（非法直接 UserInputError） */
export declare function normalizeAdDate(raw: string, label: string): string;
/** 投放天数（含首尾）与总价；规则：起止合法、end >= start、≤90 天 */
export declare function calcAdQuote(code: string, startDate: string, endDate: string): {
    slot: string;
    days: number;
    unitPriceFen: number;
    totalFen: number;
};
/** 投放是否处于展示窗口（按校园自然日判断，含首尾） */
export declare function isAdLive(row: {
    startDate: string;
    endDate: string;
    status: string;
}, today: string): boolean;
/** 对外的投放状态：running 但已过结束日 → finished（不落库，按日期实时判定） */
export declare function adViewStatus(row: {
    startDate: string;
    endDate: string;
    status: string;
}, today: string): string;
