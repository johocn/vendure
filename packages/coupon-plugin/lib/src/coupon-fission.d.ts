/**
 * 分享裂变（FR-C，t1 营销补齐 PRD）纯函数（无 IO、SSR 可用）：
 * 配置解析与活动窗口判定。配置存 Channel.customFields.couponFission（JSON 字符串，单场）。
 */
/** 活动文案：string 或 {zh,en,...} 多语言（运营 web-admin 填写） */
export type FissionText = string | Record<string, string> | null | undefined;
export interface CouponFissionConfig {
    enabled: boolean;
    name: FissionText;
    subtitle: FissionText;
    rules: FissionText;
    /** ISO 字符串；null=不限开始 */
    startsAt: string | null;
    /** ISO 字符串；null=活动无结束时间（视为未配置完整，不生效） */
    endsAt: string | null;
    /** 被分享者奖励券模板 id */
    inviteeTemplateId: number;
    /** 分享者奖励券模板 id（0/null=分享者无奖励，仅被分享者得券） */
    inviterTemplateId: number;
    /** 分享者获奖次数上限（0=不限） */
    inviterRewardLimit: number;
    /** 仅新客参与（被分享者本租户无历史有效订单才发奖） */
    newCustomerOnly: boolean;
}
/** 下发给 C 端的活动视图（文案已本地化；inviteeTemplate 必有——无被分享者奖励即视为无活动，inviterTemplate 可空） */
export interface CouponFissionView<T> {
    name: string;
    subtitle: string | null;
    rules: string | null;
    startsAt: string | null;
    endsAt: string;
    inviteeTemplate: T;
    inviterTemplate: T | null;
}
/**
 * 解析 couponFission 配置（JSON 字符串 → 规整结构）。
 * 坏 JSON / 非对象 / 字段类型不合法返回 null（SSR 友好，不炸页面）。
 */
export declare function parseCouponFissionConfig(raw: unknown): CouponFissionConfig | null;
/** 本地化活动文案：lang 形如 Vendure LanguageCode（zh_Hans / en）。兜底链同 campaign。 */
export declare function localizeFissionText(value: FissionText, lang: string): string | null;
/**
 * FR-C 个人邀请码（可逆码，分享链标准形态）：`F<base36(customerId)>`（大写 F + 大写 base36）。
 * 每位客户固定一人一码，解码直定位分享者，无快照歧义。与 nshop 前端 fissionInviteCodeOf 同构。
 */
export declare function buildReversibleInviteCode(customerId: number): string;
/** 解析可逆码 → customerId；非 F 前缀/非法 base36/非正数返回 null（调用方回退快照反查） */
export declare function parseReversibleInviteCode(code: string): number | null;
/**
 * 解析当前生效活动（纯函数）：
 * enabled + 时间窗（服务端 now 判定）+ 文案 + 被分享者奖励模板必填。
 * 不满足任一条件返回 null（C 端不渲染活动、发奖入口关闭）。
 */
export declare function resolveActiveFission<T extends {
    id: number | string;
}>(raw: unknown, templates: ReadonlyArray<T>, now: Date, lang: string): CouponFissionView<T> | null;
