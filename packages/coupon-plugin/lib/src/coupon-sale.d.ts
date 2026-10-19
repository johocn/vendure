/**
 * 券出售相关的纯函数（无 IO、SSR 可用）：
 * 退款判定、券包展开、出售目录过滤。
 */
/**
 * 出售单可退判定：出售单生成的券中「没有任何一张状态为 USED」即可退。
 * 过期券（EXPIRED）与回退券（RETURNED）均视为未使用（设计 §16-5：过期券可退）。
 * 空集合（异常数据，无券可回收）→ 拒绝，避免空退款。
 */
export declare function isSaleOrderRefundable(statuses: ReadonlyArray<string | null | undefined>): boolean;
/**
 * 券包展开：把 [{templateId, quantity}] 展开为逐张的 templateId 序列。
 * quantity 缺省 / 非法 / 小于 1 时按 1 张处理。
 */
export declare function expandBundleItems(items: ReadonlyArray<{
    templateId: number;
    quantity?: number | null;
}>): number[];
/** 出售目录过滤：仅保留 salePrice > 0 的可售模板（0 / null = 不可售）。 */
export declare function filterSaleCatalogue<T extends {
    salePrice?: number | null;
}>(templates: ReadonlyArray<T>): T[];
/** 活动文案：string 或 {zh,en,...} 多语言（运营 web-admin 填写） */
export type CampaignText = string | Record<string, string> | null | undefined;
export interface CouponCampaignConfig {
    enabled: boolean;
    name: CampaignText;
    subtitle: CampaignText;
    rules: CampaignText;
    /** ISO 字符串；null=不限端 */
    startsAt: string | null;
    endsAt: string | null;
    templateIds: number[];
    /** FR-D 新客 1 元购位：true 时仅新客可见（非新客不下发该活动位），余量耗尽整位摘除 */
    newCustomerOnly: boolean;
}
/** 下发给 C 端的活动视图（文案已本地化，templates 已按配置顺序过滤为本店可售券） */
export interface CouponCampaignView<T> {
    name: string;
    subtitle: string | null;
    rules: string | null;
    startsAt: string | null;
    endsAt: string;
    templates: T[];
    /** FR-D 新客 1 元购位标记（仅新客可见；C 端展示徽标用） */
    newCustomerOnly: boolean;
}
/**
 * 解析 couponCampaign 配置（JSON 字符串 → 规整结构）。
 * 坏 JSON / 非对象 / 字段类型不合法返回 null（SSR 友好，不炸页面）。
 */
export declare function parseCouponCampaignConfig(raw: unknown): CouponCampaignConfig | null;
/**
 * 本地化活动文案：lang 形如 Vendure LanguageCode（zh_Hans / en）。
 * 兜底链：精确 lang → 去地区码（zh_Hans→zh）→ 首个非空值 → null。
 */
export declare function localizeCampaignText(value: CampaignText, lang: string): string | null;
/**
 * 解析当前生效活动（单场，纯函数）：
 * enabled + 时间窗（服务端 now 判定，不信任前端时钟）+ templateIds 命中本店可售券（保持配置顺序）。
 * 不满足任一条件返回 null（C 端不渲染活动位）。
 */
export declare function resolveActiveCampaign<T extends {
    id: number | string;
}>(raw: unknown, saleable: ReadonlyArray<T>, now: Date, lang: string): CouponCampaignView<T> | null;
/**
 * 到手价重算（下单唯一信任源，纯函数）：
 * 学生价（仅单券，需认证通过）与首购立减（单券+券包）各自从原价计算、取低不叠加；
 * 到手价最低 1 分（避免 0 元单）。返回终价 + 优惠类型 + 让利额。
 */
export declare function resolvePromoPrice(base: number, opts: {
    studentPrice?: number | null;
    studentApproved: boolean;
    firstBuyEligible: boolean;
    firstBuyDiscount: number;
}): {
    final: number;
    discountType: 'FIRST_BUY' | 'STUDENT' | null;
    discountAmount: number;
};
