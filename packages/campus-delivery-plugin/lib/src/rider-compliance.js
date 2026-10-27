"use strict";
// P2-5 骑手合规（健康证 / 保险 / 背景调查）：纯函数判定，供 rider.service（上线/抢单资格）
// 与后台审核页共用同一口径，避免前后端口径漂移。
// 判定原则：只在「已登记但失效」时阻断（健康证过期 / 保险过期 / 背调未通过）；
// 未登记视为「待完善」不阻断，避免上线即把存量骑手全部锁死。
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_COMPLIANCE_TEXT = exports.RIDER_BACKGROUND_CHECK_STATES = void 0;
exports.evaluateRiderCompliance = evaluateRiderCompliance;
exports.normalizeCompliancePatch = normalizeCompliancePatch;
/** 到期预警窗口：距到期不足 30 天标记 expiring */
const EXPIRING_DAYS = 30;
exports.RIDER_BACKGROUND_CHECK_STATES = ['none', 'pending', 'passed', 'failed'];
function toDate(v) {
    if (v == null || v === '')
        return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
}
/** 到期状态：无到期日 → 已登记但无期限视为 ok */
function expiryStatus(expiry, now) {
    if (!expiry)
        return 'ok';
    if (expiry.getTime() < now.getTime())
        return 'expired';
    if (expiry.getTime() - now.getTime() <= EXPIRING_DAYS * 24 * 60 * 60 * 1000)
        return 'expiring';
    return 'ok';
}
/**
 * 骑手合规判定。
 * @param cf Customer.customFields（或等价对象）
 */
function evaluateRiderCompliance(cf, now = new Date()) {
    var _a, _b, _c, _d, _e;
    const f = cf !== null && cf !== void 0 ? cf : {};
    // 健康证
    const healthExpiry = toDate(f.riderHealthCertExpiry);
    const hasHealth = !!String((_a = f.riderHealthCertNo) !== null && _a !== void 0 ? _a : '').trim() || !!f.riderHealthCertImg;
    const healthStatus = !hasHealth
        ? 'missing'
        : expiryStatus(healthExpiry, now);
    // 保险
    const insuranceExpiry = toDate(f.riderInsuranceExpiry);
    const hasInsurance = !!String((_b = f.riderInsuranceNo) !== null && _b !== void 0 ? _b : '').trim();
    const insuranceStatus = !hasInsurance
        ? 'missing'
        : expiryStatus(insuranceExpiry, now);
    // 背景调查
    const bgRaw = String((_c = f.riderBackgroundCheck) !== null && _c !== void 0 ? _c : 'none');
    const bg = exports.RIDER_BACKGROUND_CHECK_STATES.includes(bgRaw)
        ? bgRaw
        : 'none';
    const bgStatus = bg === 'passed' ? 'ok' : bg === 'failed' ? 'failed' : bg === 'pending' ? 'pending' : 'missing';
    const items = [
        { key: 'healthCert', label: '健康证', status: healthStatus, expiry: healthExpiry ? healthExpiry.toISOString() : null, detail: String((_d = f.riderHealthCertNo) !== null && _d !== void 0 ? _d : '') || null },
        { key: 'insurance', label: '保险', status: insuranceStatus, expiry: insuranceExpiry ? insuranceExpiry.toISOString() : null, detail: String((_e = f.riderInsuranceNo) !== null && _e !== void 0 ? _e : '') || null },
        { key: 'backgroundCheck', label: '背景调查', status: bgStatus, expiry: null, detail: bg },
    ];
    const blocked = healthStatus === 'expired' || insuranceStatus === 'expired' || bgStatus === 'failed';
    const pending = items.some(i => i.status === 'missing' || i.status === 'pending');
    const ok = !blocked && !pending;
    return { ok, blocked, pending, items };
}
exports.MAX_COMPLIANCE_TEXT = 128;
/** 校验并规范化合规入参；返回可直接写库的 customFields 片段 */
function normalizeCompliancePatch(input) {
    var _a;
    const out = {};
    const text = (v, max = exports.MAX_COMPLIANCE_TEXT) => {
        if (v == null)
            return null;
        const s = String(v).trim();
        if (!s)
            return null;
        if (s.length > max)
            throw new Error('合规资料文本过长');
        return s;
    };
    const date = (v) => {
        if (v == null || v === '')
            return null;
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime()))
            throw new Error('日期格式不合法');
        return d;
    };
    if ('healthCertNo' in input)
        out.riderHealthCertNo = text(input.healthCertNo);
    if ('healthCertImg' in input)
        out.riderHealthCertImg = text(input.healthCertImg, 500);
    if ('healthCertExpiry' in input)
        out.riderHealthCertExpiry = date(input.healthCertExpiry);
    if ('insuranceNo' in input)
        out.riderInsuranceNo = text(input.insuranceNo);
    if ('insuranceExpiry' in input)
        out.riderInsuranceExpiry = date(input.insuranceExpiry);
    if ('backgroundCheck' in input) {
        const raw = String((_a = input.backgroundCheck) !== null && _a !== void 0 ? _a : 'none');
        if (!exports.RIDER_BACKGROUND_CHECK_STATES.includes(raw)) {
            throw new Error('背调状态不合法');
        }
        out.riderBackgroundCheck = raw;
        out.riderBackgroundCheckAt = new Date();
    }
    return out;
}
//# sourceMappingURL=rider-compliance.js.map