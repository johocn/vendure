/**
 * 菜品每日限量 / 每人限购（§68）。
 * 口径：配置为 null 或 0 = 不限；额度按「校园本地日」（UTC+8）统计已支付订单，
 * 不落库当日用量表——次日自然归零，无需定时任务重置。
 * 下单闸门校验时额外把「待付款（ArrangingPayment）」计入占用，避免并发/未付款订单突破额度。
 */
export declare const DAILY_LIMIT_MAX = 9999;
/** 占用当日额度的订单状态（已支付 / 已履约）；草稿、待付款、已取消不计 */
export declare const DAILY_LIMIT_PAID_STATES: string[];
/**
 * 下单闸门校验口径：在已支付状态基础上加入 ArrangingPayment（已进入支付流程但尚未付款）作为「占用」，
 * 配合渠道级事务锁，避免两笔并发订单都通过预检后各自支付（超卖）。展示类查询仍用 PAID 口径。
 */
export declare const DAILY_LIMIT_RESERVED_STATES: string[];
/** 限量配置归一：null / 空 / 非正数 / 非法 → null（不限），否则取整 */
export declare function normalizeLimit(value: unknown): number | null;
/** 剩余可售份数：不限返回 null，售完返回 0（不为负） */
export declare function remainingOf(limit: number | null, sold: number): number | null;
export interface LimitCheckLine {
    name: string;
    quantity: number;
    dailyLimit: number | null;
    perUserLimit: number | null;
    /** 当日其他订单已售（不含本单） */
    soldToday: number;
    /** 当日该顾客已购（不含本单） */
    mineToday: number;
}
/** 下单前置校验：命中限量/限购时返回可直接展示的错误文案，否则 null */
export declare function checkDailyLimit(line: LimitCheckLine): string | null;
/** 校园本地日 [00:00, 次日 00:00) 的 UTC 时间范围（固定 UTC+8） */
export declare function localDayRange(now?: number, tzOffsetMinutes?: number): {
    start: Date;
    end: Date;
};
/** 当日已售份数（按商品）：默认只统计已支付订单；includeReserved 时把待付款也计入占用 */
export declare function queryDailySold(raw: any, channelId: number, productIds: number[], opts?: {
    customerId?: number | null;
    excludeOrderId?: number | null;
    now?: number;
    includeReserved?: boolean;
}): Promise<Map<number, number>>;
/** 下单闸门：返回首个命中限量/限购的商品错误文案（null=全部通过） */
export declare function findDailyLimitViolation(conn: {
    rawConnection: any;
}, channelId: number, orderId: number, tx?: {
    query: (sql: string, params?: any[]) => Promise<any>;
}): Promise<string | null>;
