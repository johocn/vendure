"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.windowState = windowState;
exports.claimDateUtc8 = claimDateUtc8;
exports.parseCouponDailyClaimConfig = parseCouponDailyClaimConfig;
exports.resolveActiveDailyClaim = resolveActiveDailyClaim;
exports.parseCouponFlashSaleConfig = parseCouponFlashSaleConfig;
exports.resolveActiveFlashSale = resolveActiveFlashSale;
exports.parseCouponPayGiftConfig = parseCouponPayGiftConfig;
exports.payGiftEligible = payGiftEligible;
/**
 * FR-F 营销玩法纯函数（无 IO、SSR 友好）：每日领券 / 神券日限量抢 / 支付有礼。
 * 配置存渠道 customFields JSON（couponDailyClaim / couponFlashSale / couponPayGift），
 * 坏 JSON / 缺字段一律返回 null（R6：功能整体不启用，不炸页面）。
 * 文案复用 coupon-sale 的 CampaignText / localizeCampaignText 兜底链（R7）。
 */
const coupon_sale_1 = require("./coupon-sale");
/** 服务端 now 判定时间窗（不信任前端时钟）；startsAt/endsAt 为 null 表示不限该端。 */
function windowState(startsAt, endsAt, now) {
    if (startsAt && now.getTime() < new Date(startsAt).getTime())
        return 'PENDING';
    if (endsAt && now.getTime() > new Date(endsAt).getTime())
        return 'ENDED';
    return 'ACTIVE';
}
/** 每日领券「今天」：UTC+8 日界（Asia/Shanghai 业务日），格式 YYYY-MM-DD。 */
function claimDateUtc8(now = new Date()) {
    return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
function textOrNull(v) {
    return typeof v === 'string' || (v && typeof v === 'object') ? v : null;
}
function idsOrEmpty(v) {
    return Array.isArray(v)
        ? v.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n > 0)
        : [];
}
function dateOrNull(v) {
    if (typeof v !== 'string' || !v.trim())
        return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
/**
 * 解析 couponDailyClaim 配置。与 campaign 形状对齐（enabled/name/subtitle/rules/startsAt/endsAt/templateIds），
 * 但 startsAt/endsAt 允许 null（长期活动）。
 */
function parseCouponDailyClaimConfig(raw) {
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
    const templateIds = idsOrEmpty(obj.templateIds);
    if (!templateIds.length)
        return null;
    return {
        enabled: obj.enabled !== false,
        name: textOrNull(obj.name),
        subtitle: textOrNull(obj.subtitle),
        rules: textOrNull(obj.rules),
        startsAt: dateOrNull(obj.startsAt),
        endsAt: dateOrNull(obj.endsAt),
        templateIds,
    };
}
/**
 * 解析当前生效的每日领券活动（纯函数）：enabled + 可选时间窗 + 模板命中 + 名称可本地化。
 * 不满足返回 null（C 端不渲染入口 / API 硬拦 INACTIVE）。
 */
function resolveActiveDailyClaim(raw, usable, now, lang) {
    const config = parseCouponDailyClaimConfig(raw);
    if (!config || !config.enabled || !config.templateIds.length)
        return null;
    if (windowState(config.startsAt, config.endsAt, now) !== 'ACTIVE')
        return null;
    const byId = new Map(usable.map(t => [Number(t.id), t]));
    const templates = config.templateIds.map(id => byId.get(id)).filter((t) => !!t);
    if (!templates.length)
        return null;
    const name = (0, coupon_sale_1.localizeCampaignText)(config.name, lang);
    if (!name)
        return null;
    return {
        name,
        subtitle: (0, coupon_sale_1.localizeCampaignText)(config.subtitle, lang),
        rules: (0, coupon_sale_1.localizeCampaignText)(config.rules, lang),
        startsAt: config.startsAt,
        endsAt: config.endsAt,
        templates,
    };
}
function parseCouponFlashSaleConfig(raw) {
    var _a;
    if (raw == null || raw === '')
        return null;
    let obj = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        }
        catch (_b) {
            return null;
        }
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj))
        return null;
    const templateIds = idsOrEmpty(obj.templateIds);
    if (!templateIds.length)
        return null;
    const perUserLimit = Math.max(1, Math.floor(Number((_a = obj.perUserLimit) !== null && _a !== void 0 ? _a : 1)) || 1);
    return {
        enabled: obj.enabled !== false,
        name: textOrNull(obj.name),
        subtitle: textOrNull(obj.subtitle),
        rules: textOrNull(obj.rules),
        startsAt: dateOrNull(obj.startsAt),
        endsAt: dateOrNull(obj.endsAt),
        templateIds,
        perUserLimit,
    };
}
/**
 * 解析进行中的神券日场次（纯函数）：enabled + 窗口完整且 now 在窗内 + 模板命中 + 名称可本地化。
 */
function resolveActiveFlashSale(raw, usable, now, lang) {
    const config = parseCouponFlashSaleConfig(raw);
    if (!config || !config.enabled || !config.templateIds.length)
        return null;
    if (!config.startsAt || !config.endsAt)
        return null;
    if (windowState(config.startsAt, config.endsAt, now) !== 'ACTIVE')
        return null;
    const byId = new Map(usable.map(t => [Number(t.id), t]));
    const templates = config.templateIds.map(id => byId.get(id)).filter((t) => !!t);
    if (!templates.length)
        return null;
    const name = (0, coupon_sale_1.localizeCampaignText)(config.name, lang);
    if (!name)
        return null;
    return {
        name,
        subtitle: (0, coupon_sale_1.localizeCampaignText)(config.subtitle, lang),
        rules: (0, coupon_sale_1.localizeCampaignText)(config.rules, lang),
        startsAt: config.startsAt,
        endsAt: config.endsAt,
        perUserLimit: config.perUserLimit,
        templates,
    };
}
/**
 * 解析 couponPayGift 配置：enabled 且 templateId>0 才算配置有效，否则 null。
 */
function parseCouponPayGiftConfig(raw) {
    var _a, _b, _c;
    if (raw == null || raw === '')
        return null;
    let obj = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        }
        catch (_d) {
            return null;
        }
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj))
        return null;
    const templateId = Math.floor(Number((_a = obj.templateId) !== null && _a !== void 0 ? _a : 0));
    if (!Number.isFinite(templateId) || templateId <= 0)
        return null;
    const minAmount = Math.max(0, Math.floor(Number((_b = obj.minAmount) !== null && _b !== void 0 ? _b : 0)) || 0);
    const cooldownDays = Math.min(365, Math.max(1, Math.floor(Number((_c = obj.cooldownDays) !== null && _c !== void 0 ? _c : 1)) || 1));
    return {
        enabled: obj.enabled !== false,
        templateId,
        minAmount,
        cooldownDays,
    };
}
/** 支付有礼门槛判定（纯函数）：订单实付（分）≥ minAmount（0=不限）才发。 */
function payGiftEligible(config, orderTotal) {
    if (config.minAmount <= 0)
        return true;
    return Math.floor(Number(orderTotal) || 0) >= config.minAmount;
}
//# sourceMappingURL=coupon-frf.js.map