/**
 * FR-F 营销玩法纯函数（无 IO、SSR 友好）：每日领券 / 神券日限量抢 / 支付有礼。
 * 配置存渠道 customFields JSON（couponDailyClaim / couponFlashSale / couponPayGift），
 * 坏 JSON / 缺字段一律返回 null（R6：功能整体不启用，不炸页面）。
 * 文案复用 coupon-sale 的 CampaignText / localizeCampaignText 兜底链（R7）。
 */
import { CampaignText } from './coupon-sale';
export type WindowState = 'PENDING' | 'ACTIVE' | 'ENDED';
/** 服务端 now 判定时间窗（不信任前端时钟）；startsAt/endsAt 为 null 表示不限该端。 */
export declare function windowState(startsAt: string | null, endsAt: string | null, now: Date): WindowState;
/** 每日领券「今天」：UTC+8 日界（Asia/Shanghai 业务日），格式 YYYY-MM-DD。 */
export declare function claimDateUtc8(now?: Date): string;
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
/**
 * 解析 couponDailyClaim 配置。与 campaign 形状对齐（enabled/name/subtitle/rules/startsAt/endsAt/templateIds），
 * 但 startsAt/endsAt 允许 null（长期活动）。
 */
export declare function parseCouponDailyClaimConfig(raw: unknown): CouponDailyClaimConfig | null;
/**
 * 解析当前生效的每日领券活动（纯函数）：enabled + 可选时间窗 + 模板命中 + 名称可本地化。
 * 不满足返回 null（C 端不渲染入口 / API 硬拦 INACTIVE）。
 */
export declare function resolveActiveDailyClaim<T extends {
    id: number | string;
}>(raw: unknown, usable: ReadonlyArray<T>, now: Date, lang: string): CouponDailyClaimView<T> | null;
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
export declare function parseCouponFlashSaleConfig(raw: unknown): CouponFlashSaleConfig | null;
/**
 * 解析进行中的神券日场次（纯函数）：enabled + 窗口完整且 now 在窗内 + 模板命中 + 名称可本地化。
 */
export declare function resolveActiveFlashSale<T extends {
    id: number | string;
}>(raw: unknown, usable: ReadonlyArray<T>, now: Date, lang: string): CouponFlashSaleView<T> | null;
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
export declare function parseCouponPayGiftConfig(raw: unknown): CouponPayGiftConfig | null;
/** 支付有礼门槛判定（纯函数）：订单实付（分）≥ minAmount（0=不限）才发。 */
export declare function payGiftEligible(config: CouponPayGiftConfig, orderTotal: number): boolean;
