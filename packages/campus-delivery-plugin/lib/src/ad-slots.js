"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AD_SLOT_CODES = exports.AD_SLOTS = void 0;
exports.findAdSlot = findAdSlot;
exports.normalizeAdDate = normalizeAdDate;
exports.calcAdQuote = calcAdQuote;
exports.isAdLive = isAdLive;
exports.adViewStatus = adViewStatus;
// P2-3 广告位与商家自助投放计费：广告位定义 + 报价 + 视图口径。
//
// 广告位是平台固定资源，单价（分/天）写死在这里；商家下单时按下单当时的单价固化，
// 之后调整单价不影响已创建的投放单。
const core_1 = require("@vendure/core");
exports.AD_SLOTS = [
    { code: 'homeBanner', name: '首页横幅', unitPriceFen: 1500 },
    { code: 'shopTop', name: '店铺页顶部', unitPriceFen: 800 },
];
exports.AD_SLOT_CODES = exports.AD_SLOTS.map(s => s.code);
function findAdSlot(code) {
    const slot = exports.AD_SLOTS.find(s => s.code === code);
    if (!slot)
        throw new core_1.UserInputError(`不支持的广告位: ${code || '(空)'}`);
    return slot;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 3600000;
const MAX_DAYS = 90;
/** 校验并归一 YYYY-MM-DD（非法直接 UserInputError） */
function normalizeAdDate(raw, label) {
    const s = String(raw !== null && raw !== void 0 ? raw : '').trim();
    if (!DATE_RE.test(s))
        throw new core_1.UserInputError(`${label}格式应为 YYYY-MM-DD`);
    const t = Date.parse(`${s}T00:00:00Z`);
    if (Number.isNaN(t))
        throw new core_1.UserInputError(`${label}不是有效日期`);
    return s;
}
/** 投放天数（含首尾）与总价；规则：起止合法、end >= start、≤90 天 */
function calcAdQuote(code, startDate, endDate) {
    const slot = findAdSlot(code);
    const start = normalizeAdDate(startDate, '开始日期');
    const end = normalizeAdDate(endDate, '结束日期');
    const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
    if (days < 1)
        throw new core_1.UserInputError('结束日期不能早于开始日期');
    if (days > MAX_DAYS)
        throw new core_1.UserInputError(`单笔投放不能超过 ${MAX_DAYS} 天`);
    return { slot: slot.code, days, unitPriceFen: slot.unitPriceFen, totalFen: slot.unitPriceFen * days };
}
/** 投放是否处于展示窗口（按校园自然日判断，含首尾） */
function isAdLive(row, today) {
    if (row.status !== 'running')
        return false;
    return row.startDate <= today && today <= row.endDate;
}
/** 对外的投放状态：running 但已过结束日 → finished（不落库，按日期实时判定） */
function adViewStatus(row, today) {
    if (row.status === 'running' && today > row.endDate)
        return 'finished';
    return row.status;
}
//# sourceMappingURL=ad-slots.js.map