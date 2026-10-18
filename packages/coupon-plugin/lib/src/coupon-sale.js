"use strict";
/**
 * 券出售相关的纯函数（无 IO、SSR 可用）：
 * 退款判定、券包展开、出售目录过滤。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSaleOrderRefundable = isSaleOrderRefundable;
exports.expandBundleItems = expandBundleItems;
exports.filterSaleCatalogue = filterSaleCatalogue;
exports.parseCouponCampaignConfig = parseCouponCampaignConfig;
exports.localizeCampaignText = localizeCampaignText;
exports.resolveActiveCampaign = resolveActiveCampaign;
exports.resolvePromoPrice = resolvePromoPrice;
/**
 * 出售单可退判定：出售单生成的券中「没有任何一张状态为 USED」即可退。
 * 过期券（EXPIRED）与回退券（RETURNED）均视为未使用（设计 §16-5：过期券可退）。
 * 空集合（异常数据，无券可回收）→ 拒绝，避免空退款。
 */
function isSaleOrderRefundable(statuses) {
    if (statuses.length === 0) {
        return false;
    }
    return statuses.every(s => s !== 'USED');
}
/**
 * 券包展开：把 [{templateId, quantity}] 展开为逐张的 templateId 序列。
 * quantity 缺省 / 非法 / 小于 1 时按 1 张处理。
 */
function expandBundleItems(items) {
    var _a;
    const out = [];
    for (const item of items) {
        const qty = Math.max(1, Math.floor(Number((_a = item.quantity) !== null && _a !== void 0 ? _a : 1)) || 1);
        for (let i = 0; i < qty; i++) {
            out.push(item.templateId);
        }
    }
    return out;
}
/** 出售目录过滤：仅保留 salePrice > 0 的可售模板（0 / null = 不可售）。 */
function filterSaleCatalogue(templates) {
    return templates.filter(t => { var _a; return Number((_a = t.salePrice) !== null && _a !== void 0 ? _a : 0) > 0; });
}
/**
 * 解析 couponCampaign 配置（JSON 字符串 → 规整结构）。
 * 坏 JSON / 非对象 / 字段类型不合法返回 null（SSR 友好，不炸页面）。
 */
function parseCouponCampaignConfig(raw) {
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
    const templateIds = Array.isArray(obj.templateIds)
        ? obj.templateIds.map((v) => Math.floor(Number(v))).filter((n) => Number.isFinite(n) && n > 0)
        : [];
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
        templateIds,
    };
}
/**
 * 本地化活动文案：lang 形如 Vendure LanguageCode（zh_Hans / en）。
 * 兜底链：精确 lang → 去地区码（zh_Hans→zh）→ 首个非空值 → null。
 */
function localizeCampaignText(value, lang) {
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
 * 解析当前生效活动（单场，纯函数）：
 * enabled + 时间窗（服务端 now 判定，不信任前端时钟）+ templateIds 命中本店可售券（保持配置顺序）。
 * 不满足任一条件返回 null（C 端不渲染活动位）。
 */
function resolveActiveCampaign(raw, saleable, now, lang) {
    const config = parseCouponCampaignConfig(raw);
    if (!config || !config.enabled || !config.templateIds.length)
        return null;
    if (config.startsAt && now.getTime() < new Date(config.startsAt).getTime())
        return null;
    if (!config.endsAt || now.getTime() > new Date(config.endsAt).getTime())
        return null;
    const byId = new Map(saleable.map(t => [Number(t.id), t]));
    const templates = config.templateIds
        .map(id => byId.get(id))
        .filter((t) => !!t);
    if (!templates.length)
        return null;
    const name = localizeCampaignText(config.name, lang);
    if (!name)
        return null;
    return {
        name,
        subtitle: localizeCampaignText(config.subtitle, lang),
        rules: localizeCampaignText(config.rules, lang),
        startsAt: config.startsAt,
        endsAt: config.endsAt,
        templates,
    };
}
/**
 * 到手价重算（下单唯一信任源，纯函数）：
 * 学生价（仅单券，需认证通过）与首购立减（单券+券包）各自从原价计算、取低不叠加；
 * 到手价最低 1 分（避免 0 元单）。返回终价 + 优惠类型 + 让利额。
 */
function resolvePromoPrice(base, opts) {
    var _a;
    const baseFinal = Math.max(1, Math.floor(Number(base) || 0));
    // 两条优惠路径各自从原价独立计算（取低不叠加），同价时优先记为学生价
    const studentPrice = Math.floor(Number((_a = opts.studentPrice) !== null && _a !== void 0 ? _a : 0));
    const candidates = [];
    if (studentPrice > 0 && opts.studentApproved && studentPrice < baseFinal) {
        candidates.push({ final: Math.max(1, studentPrice), type: 'STUDENT' });
    }
    if (opts.firstBuyDiscount > 0 && opts.firstBuyEligible) {
        const v = Math.max(1, baseFinal - Math.floor(opts.firstBuyDiscount));
        if (v < baseFinal) {
            candidates.push({ final: v, type: 'FIRST_BUY' });
        }
    }
    if (!candidates.length) {
        return { final: baseFinal, discountType: null, discountAmount: 0 };
    }
    const best = candidates.reduce((a, b) => (b.final < a.final ? b : a));
    return { final: best.final, discountType: best.type, discountAmount: baseFinal - best.final };
}
//# sourceMappingURL=coupon-sale.js.map