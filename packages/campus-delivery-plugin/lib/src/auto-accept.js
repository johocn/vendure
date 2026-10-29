"use strict";
/**
 * 商家自动接单（§69）：纯函数决策，供 AutoAcceptJob / 后台设置共用。
 * 只处理 pending_merchant（待商家接单）订单：营业中且未临时休息、在延迟秒数之后、
 * 适用范围路线命中、且未超过每日自动接单上限，才自动确认进入备餐。
 * 超限或休息时退回人工接单，不做任何降级取消。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_ACCEPT_MAX_DAILY_LIMIT = exports.AUTO_ACCEPT_DEFAULT_DELAY_SECONDS = exports.AUTO_ACCEPT_MAX_DELAY_SECONDS = exports.AUTO_ACCEPT_ROUTES = void 0;
exports.normalizeAutoAcceptRoutes = normalizeAutoAcceptRoutes;
exports.isAutoAcceptDue = isAutoAcceptDue;
exports.canAutoAcceptStatus = canAutoAcceptStatus;
/** 可自动接单的路线（pending_merchant 只会出现在外卖配送路线） */
exports.AUTO_ACCEPT_ROUTES = ['R1', 'R2', 'R3'];
/** 延迟秒数上限：留足改单/拒单窗口，避免秒接导致用户改不了地址 */
exports.AUTO_ACCEPT_MAX_DELAY_SECONDS = 600;
exports.AUTO_ACCEPT_DEFAULT_DELAY_SECONDS = 30;
/** 每日自动接单上限（0 = 不限）的校验上限 */
exports.AUTO_ACCEPT_MAX_DAILY_LIMIT = 999;
/** 清洗适用范围：未知路线丢弃；空值回落全部路线 */
function normalizeAutoAcceptRoutes(raw) {
    const list = Array.isArray(raw)
        ? raw
        : String(raw !== null && raw !== void 0 ? raw : '')
            .split(',')
            .map(s => s.trim());
    const picked = list
        .map(v => String(v !== null && v !== void 0 ? v : '').trim().toUpperCase())
        .filter(v => exports.AUTO_ACCEPT_ROUTES.includes(v));
    return picked.length ? [...new Set(picked)] : [...exports.AUTO_ACCEPT_ROUTES];
}
function isAutoAcceptDue(d) {
    var _a;
    if (!d.enabled || !d.openNow)
        return false;
    if (!normalizeAutoAcceptRoutes(d.routes).includes(String((_a = d.route) !== null && _a !== void 0 ? _a : '')))
        return false;
    if (d.dailyLimit > 0 && d.acceptedToday >= d.dailyLimit)
        return false;
    const delay = Math.max(0, Number(d.delaySeconds) || 0);
    return d.elapsedMs >= delay * 1000;
}
/** 判断订单是否处于可自动接单状态（hallStatus 必须仍是 pending_merchant） */
function canAutoAcceptStatus(hallStatus) {
    return String(hallStatus !== null && hallStatus !== void 0 ? hallStatus : '') === 'pending_merchant';
}
//# sourceMappingURL=auto-accept.js.map