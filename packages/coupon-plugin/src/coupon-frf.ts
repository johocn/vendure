/**
 * FR-F 营销玩法纯函数（无 IO、SSR 友好）：每日领券 / 神券日限量抢 / 支付有礼。
 * 配置存渠道 customFields JSON（couponDailyClaim / couponFlashSale / couponPayGift），
 * 坏 JSON / 缺字段一律返回 null（R6：功能整体不启用，不炸页面）。
 * 文案复用 coupon-sale 的 CampaignText / localizeCampaignText 兜底链（R7）。
 */
import { CampaignText, localizeCampaignText } from './coupon-sale';

/* ------------------------------ 时间窗 ------------------------------ */

export type WindowState = 'PENDING' | 'ACTIVE' | 'ENDED';

/** 服务端 now 判定时间窗（不信任前端时钟）；startsAt/endsAt 为 null 表示不限该端。 */
export function windowState(startsAt: string | null, endsAt: string | null, now: Date): WindowState {
    if (startsAt && now.getTime() < new Date(startsAt).getTime()) return 'PENDING';
    if (endsAt && now.getTime() > new Date(endsAt).getTime()) return 'ENDED';
    return 'ACTIVE';
}

/** 每日领券「今天」：UTC+8 日界（Asia/Shanghai 业务日），格式 YYYY-MM-DD。 */
export function claimDateUtc8(now: Date = new Date()): string {
    return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

/* --------------------------- FR-F1 每日领券 --------------------------- */

export interface CouponDailyClaimConfig {
    enabled: boolean;
    name: CampaignText;
    subtitle: CampaignText;
    rules: CampaignText;
    /** 可 null = 长期每日领券 */
    startsAt: string | null;
    endsAt: string | null;
    templateIds: number[];
}

/** C 端视图（文案已本地化，templates 已按配置顺序过滤为本店可用券） */
export interface CouponDailyClaimView<T> {
    name: string;
    subtitle: string | null;
    rules: string | null;
    startsAt: string | null;
    endsAt: string | null;
    templates: T[];
}

function textOrNull(v: unknown): CampaignText {
    return typeof v === 'string' || (v && typeof v === 'object') ? (v as CampaignText) : null;
}

function idsOrEmpty(v: unknown): number[] {
    return Array.isArray(v)
        ? v.map((x: unknown) => Math.floor(Number(x))).filter((n: number) => Number.isFinite(n) && n > 0)
        : [];
}

function dateOrNull(v: unknown): string | null {
    if (typeof v !== 'string' || !v.trim()) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 解析 couponDailyClaim 配置。与 campaign 形状对齐（enabled/name/subtitle/rules/startsAt/endsAt/templateIds），
 * 但 startsAt/endsAt 允许 null（长期活动）。
 */
export function parseCouponDailyClaimConfig(raw: unknown): CouponDailyClaimConfig | null {
    if (raw == null || raw === '') return null;
    let obj: any = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
    const templateIds = idsOrEmpty(obj.templateIds);
    if (!templateIds.length) return null;
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
export function resolveActiveDailyClaim<T extends { id: number | string }>(
    raw: unknown,
    usable: ReadonlyArray<T>,
    now: Date,
    lang: string,
): CouponDailyClaimView<T> | null {
    const config = parseCouponDailyClaimConfig(raw);
    if (!config || !config.enabled || !config.templateIds.length) return null;
    if (windowState(config.startsAt, config.endsAt, now) !== 'ACTIVE') return null;
    const byId = new Map(usable.map(t => [Number(t.id), t]));
    const templates = config.templateIds.map(id => byId.get(id)).filter((t): t is T => !!t);
    if (!templates.length) return null;
    const name = localizeCampaignText(config.name, lang);
    if (!name) return null;
    return {
        name,
        subtitle: localizeCampaignText(config.subtitle, lang),
        rules: localizeCampaignText(config.rules, lang),
        startsAt: config.startsAt,
        endsAt: config.endsAt,
        templates,
    };
}

/* -------------------------- FR-F2 神券日限量抢 -------------------------- */

export interface CouponFlashSaleConfig {
    enabled: boolean;
    name: CampaignText;
    subtitle: CampaignText;
    rules: CampaignText;
    /** 场次窗口：flash 必须有明确窗口（两者均需有效） */
    startsAt: string | null;
    endsAt: string | null;
    templateIds: number[];
    /** 场次内每人同券限抢张数（默认 1；0 视为 1） */
    perUserLimit: number;
}

export interface CouponFlashSaleView<T> {
    name: string;
    subtitle: string | null;
    rules: string | null;
    startsAt: string;
    endsAt: string;
    perUserLimit: number;
    templates: T[];
}

export function parseCouponFlashSaleConfig(raw: unknown): CouponFlashSaleConfig | null {
    if (raw == null || raw === '') return null;
    let obj: any = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
    const templateIds = idsOrEmpty(obj.templateIds);
    if (!templateIds.length) return null;
    const perUserLimit = Math.max(1, Math.floor(Number(obj.perUserLimit ?? 1)) || 1);
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
export function resolveActiveFlashSale<T extends { id: number | string }>(
    raw: unknown,
    usable: ReadonlyArray<T>,
    now: Date,
    lang: string,
): CouponFlashSaleView<T> | null {
    const config = parseCouponFlashSaleConfig(raw);
    if (!config || !config.enabled || !config.templateIds.length) return null;
    if (!config.startsAt || !config.endsAt) return null;
    if (windowState(config.startsAt, config.endsAt, now) !== 'ACTIVE') return null;
    const byId = new Map(usable.map(t => [Number(t.id), t]));
    const templates = config.templateIds.map(id => byId.get(id)).filter((t): t is T => !!t);
    if (!templates.length) return null;
    const name = localizeCampaignText(config.name, lang);
    if (!name) return null;
    return {
        name,
        subtitle: localizeCampaignText(config.subtitle, lang),
        rules: localizeCampaignText(config.rules, lang),
        startsAt: config.startsAt,
        endsAt: config.endsAt,
        perUserLimit: config.perUserLimit,
        templates,
    };
}

/* ---------------------------- FR-F3 支付有礼 ---------------------------- */

export interface CouponPayGiftConfig {
    enabled: boolean;
    /** 奖励券模板；0 = 未配置 */
    templateId: number;
    /** 订单实付门槛（分，与 Vendure Money 一致）；0 = 不限 */
    minAmount: number;
    /** 同模板冷却天数（强制 ≥1，防 PaymentSettled 重复事件重复发券） */
    cooldownDays: number;
}

/**
 * 解析 couponPayGift 配置：enabled 且 templateId>0 才算配置有效，否则 null。
 */
export function parseCouponPayGiftConfig(raw: unknown): CouponPayGiftConfig | null {
    if (raw == null || raw === '') return null;
    let obj: any = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
    const templateId = Math.floor(Number(obj.templateId ?? 0));
    if (!Number.isFinite(templateId) || templateId <= 0) return null;
    const minAmount = Math.max(0, Math.floor(Number(obj.minAmount ?? 0)) || 0);
    const cooldownDays = Math.min(365, Math.max(1, Math.floor(Number(obj.cooldownDays ?? 1)) || 1));
    return {
        enabled: obj.enabled !== false,
        templateId,
        minAmount,
        cooldownDays,
    };
}

/** 支付有礼门槛判定（纯函数）：订单实付（分）≥ minAmount（0=不限）才发。 */
export function payGiftEligible(config: CouponPayGiftConfig, orderTotal: number): boolean {
    if (config.minAmount <= 0) return true;
    return Math.floor(Number(orderTotal) || 0) >= config.minAmount;
}
