"use strict";
/**
 * 分享裂变（FR-C，t1 营销补齐 PRD）纯函数（无 IO、SSR 可用）：
 * 配置解析与活动窗口判定。配置存 Channel.customFields.couponFission（JSON 字符串，单场）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCouponFissionConfig = parseCouponFissionConfig;
exports.localizeFissionText = localizeFissionText;
exports.resolveActiveFission = resolveActiveFission;
/**
 * 解析 couponFission 配置（JSON 字符串 → 规整结构）。
 * 坏 JSON / 非对象 / 字段类型不合法返回 null（SSR 友好，不炸页面）。
 */
function parseCouponFissionConfig(raw) {
    if (raw == null || raw === '')
        return null;
    let obj = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        }
        catch (_a) {
            return null;
        }
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj))
        return null;
    const posInt = (v) => Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0;
    const dateOrNull = (v) => {
        if (typeof v !== 'string' || !v.trim())
            return null;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };
    return {
        enabled: obj.enabled !== false,
        name: (typeof obj.name === 'string' || (obj.name && typeof obj.name === 'object')) ? obj.name : null,
        subtitle: (typeof obj.subtitle === 'string' || (obj.subtitle && typeof obj.subtitle === 'object')) ? obj.subtitle : null,
        rules: (typeof obj.rules === 'string' || (obj.rules && typeof obj.rules === 'object')) ? obj.rules : null,
        startsAt: dateOrNull(obj.startsAt),
        endsAt: dateOrNull(obj.endsAt),
        inviteeTemplateId: posInt(obj.inviteeTemplateId),
        inviterTemplateId: posInt(obj.inviterTemplateId),
        inviterRewardLimit: posInt(obj.inviterRewardLimit),
        newCustomerOnly: obj.newCustomerOnly === true,
    };
}
/** 本地化活动文案：lang 形如 Vendure LanguageCode（zh_Hans / en）。兜底链同 campaign。 */
function localizeFissionText(value, lang) {
    if (value == null)
        return null;
    if (typeof value === 'string')
        return value.trim() || null;
    const langs = [lang, String(lang).split('_')[0]].filter((l, i, a) => l && a.indexOf(l) === i);
    for (const l of langs) {
        const v = value[l];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    const first = Object.values(value).find(v => typeof v === 'string' && v.trim());
    return first ? String(first).trim() : null;
}
/**
 * 解析当前生效活动（纯函数）：
 * enabled + 时间窗（服务端 now 判定）+ 文案 + 被分享者奖励模板必填。
 * 不满足任一条件返回 null（C 端不渲染活动、发奖入口关闭）。
 */
function resolveActiveFission(raw, templates, now, lang) {
    var _a, _b;
    const config = parseCouponFissionConfig(raw);
    if (!config || !config.enabled || !config.inviteeTemplateId)
        return null;
    if (config.startsAt && now.getTime() < new Date(config.startsAt).getTime())
        return null;
    if (!config.endsAt || now.getTime() > new Date(config.endsAt).getTime())
        return null;
    const name = localizeFissionText(config.name, lang);
    if (!name)
        return null;
    const byId = new Map(templates.map(t => [Number(t.id), t]));
    const inviteeTemplate = (_a = byId.get(config.inviteeTemplateId)) !== null && _a !== void 0 ? _a : null;
    if (!inviteeTemplate)
        return null;
    return {
        name,
        subtitle: localizeFissionText(config.subtitle, lang),
        rules: localizeFissionText(config.rules, lang),
        startsAt: config.startsAt,
        endsAt: config.endsAt,
        inviteeTemplate,
        inviterTemplate: config.inviterTemplateId
            ? ((_b = byId.get(config.inviterTemplateId)) !== null && _b !== void 0 ? _b : null)
            : null,
    };
}
//# sourceMappingURL=coupon-fission.js.map