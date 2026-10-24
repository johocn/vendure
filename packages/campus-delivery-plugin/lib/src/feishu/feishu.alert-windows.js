"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALERT_WINDOWS_MIN = void 0;
/**
 * 飞书提前告警窗口（分钟）：dispatch-job 提前告警 + command.service soonOverdueOf 共用同一套提前量。
 * 两边都从 fulfillmentConfig 的兜底阈值动态算 alertMs，这里只存「提前量」的常数值。
 *
 * 规则：提前量 = 兜底阈值 - 告警窗口（window）。
 *       dispatch-job: now - at >= alertMs → 推提前告警
 *       command.service soonOverdueOf: m >= threshold - window && m <= threshold → 看板显示即将超时
 */
exports.ALERT_WINDOWS_MIN = {
    /** pending_merchant：acceptMs - 1min 时推 ⚠️ 商家即将超时 */
    accept: 1,
    /** grabbed+assigned：NOT_PICKED - 1.5min 时推 ⏱ 骑手取货超时 */
    riderPick: 1.5,
    /** third_party：fallbackMs - 2.5min 时推 📦 外部快递在途超时 */
    thirdParty: 2.5,
    /** exception：SLA/6（≈7.5min）时推 🚨 异常待处置（派生值，非固定提前量） */
    exceptionDivisor: 6,
};
//# sourceMappingURL=feishu.alert-windows.js.map