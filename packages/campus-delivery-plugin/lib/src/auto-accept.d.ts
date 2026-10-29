/**
 * 商家自动接单（§69）：纯函数决策，供 AutoAcceptJob / 后台设置共用。
 * 只处理 pending_merchant（待商家接单）订单：营业中且未临时休息、在延迟秒数之后、
 * 适用范围路线命中、且未超过每日自动接单上限，才自动确认进入备餐。
 * 超限或休息时退回人工接单，不做任何降级取消。
 */
/** 可自动接单的路线（pending_merchant 只会出现在外卖配送路线） */
export declare const AUTO_ACCEPT_ROUTES: readonly ["R1", "R2", "R3"];
/** 延迟秒数上限：留足改单/拒单窗口，避免秒接导致用户改不了地址 */
export declare const AUTO_ACCEPT_MAX_DELAY_SECONDS = 600;
export declare const AUTO_ACCEPT_DEFAULT_DELAY_SECONDS = 30;
/** 每日自动接单上限（0 = 不限）的校验上限 */
export declare const AUTO_ACCEPT_MAX_DAILY_LIMIT = 999;
/** 清洗适用范围：未知路线丢弃；空值回落全部路线 */
export declare function normalizeAutoAcceptRoutes(raw: unknown): string[];
export interface AutoAcceptDecision {
    enabled: boolean;
    openNow: boolean;
    /** 下单后经过的毫秒（锚点 hallEnteredAt，预约单从放量时刻起算） */
    elapsedMs: number;
    delaySeconds: number;
    route: string;
    routes: string[];
    /** 本校园日已自动接单数（包含跨渠道？否：本店口径） */
    acceptedToday: number;
    /** 0 = 不限 */
    dailyLimit: number;
}
export declare function isAutoAcceptDue(d: AutoAcceptDecision): boolean;
/** 判断订单是否处于可自动接单状态（hallStatus 必须仍是 pending_merchant） */
export declare function canAutoAcceptStatus(hallStatus: unknown): boolean;
