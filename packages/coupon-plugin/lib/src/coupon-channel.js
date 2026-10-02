"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_COUPON_CHANNELS = void 0;
exports.parseDistributionChannels = parseDistributionChannels;
exports.resolveCouponChannels = resolveCouponChannels;
exports.hasChannel = hasChannel;
exports.matchesScene = matchesScene;
exports.filterTemplatesByChannelAndScene = filterTemplatesByChannelAndScene;
/** 全部合法渠道代号（顺序即后台展示顺序） */
exports.ALL_COUPON_CHANNELS = [
    'CENTRE',
    'SALE',
    'POINTS',
    'CODE',
    'PRODUCT',
    'GRANT',
];
/**
 * 解析逗号分隔的渠道集合：去空白、转大写、去重、忽略未知代号。
 * null / undefined / 空串 / 全为未知代号 → 空数组（调用方据此回落老字段推导）。
 */
function parseDistributionChannels(raw) {
    if (raw == null)
        return [];
    const out = [];
    for (const part of String(raw).split(',')) {
        const code = part.trim().toUpperCase();
        if (exports.ALL_COUPON_CHANNELS.includes(code) && !out.includes(code)) {
            out.push(code);
        }
    }
    return out;
}
/**
 * 解析券模板的分发渠道集合。
 * 显式配置优先（不再叠加老字段）；未配置时按老字段推导，保证历史券行为不变。
 * GRANT 无历史推导来源，故历史券默认不含定向发放。
 */
function resolveCouponChannels(tpl, hasProductBinding) {
    var _a;
    const explicit = parseDistributionChannels(tpl === null || tpl === void 0 ? void 0 : tpl.distributionChannels);
    if (explicit.length > 0)
        return explicit;
    const derived = [];
    if (tpl === null || tpl === void 0 ? void 0 : tpl.claimable)
        derived.push('CENTRE');
    if (Number((_a = tpl === null || tpl === void 0 ? void 0 : tpl.pointsPrice) !== null && _a !== void 0 ? _a : 0) > 0)
        derived.push('POINTS');
    if (tpl === null || tpl === void 0 ? void 0 : tpl.claimCode)
        derived.push('CODE');
    if (hasProductBinding)
        derived.push('PRODUCT');
    return derived;
}
/** 该模板是否可通过指定渠道分发 */
function hasChannel(tpl, hasProductBinding, channel) {
    return resolveCouponChannels(tpl, hasProductBinding).includes(channel);
}
/**
 * 场景匹配：ALL 同时匹配线上与到店；null / undefined 按 ONLINE 处理（历史数据语义）。
 */
function matchesScene(usageScene, scene) {
    const s = (usageScene !== null && usageScene !== void 0 ? usageScene : 'ONLINE');
    return s === 'ALL' || s === scene;
}
/**
 * 列表精筛：仅保留「渠道命中 + 场景命中」的模板。
 * 用于各 C 端渠道查询在 SQL 粗筛之后做精确过滤。
 */
function filterTemplatesByChannelAndScene(templates, channel, scene) {
    return templates.filter(tpl => hasChannel(tpl, false, channel) && matchesScene(tpl.usageScene, scene));
}
//# sourceMappingURL=coupon-channel.js.map