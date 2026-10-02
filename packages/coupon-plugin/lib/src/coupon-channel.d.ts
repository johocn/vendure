import type { CouponChannel, CouponUsageScene } from './types';
/** 全部合法渠道代号（顺序即后台展示顺序） */
export declare const ALL_COUPON_CHANNELS: ReadonlyArray<CouponChannel>;
/** 参与渠道判定的模板字段子集（避免依赖实体运行时） */
export interface CouponChannelFields {
    distributionChannels?: string | null;
    claimable?: boolean | null;
    pointsPrice?: number | null;
    claimCode?: string | null;
    usageScene?: string | null;
}
/**
 * 解析逗号分隔的渠道集合：去空白、转大写、去重、忽略未知代号。
 * null / undefined / 空串 / 全为未知代号 → 空数组（调用方据此回落老字段推导）。
 */
export declare function parseDistributionChannels(raw?: string | null): CouponChannel[];
/**
 * 解析券模板的分发渠道集合。
 * 显式配置优先（不再叠加老字段）；未配置时按老字段推导，保证历史券行为不变。
 * GRANT 无历史推导来源，故历史券默认不含定向发放。
 */
export declare function resolveCouponChannels(tpl: CouponChannelFields | null | undefined, hasProductBinding: boolean): CouponChannel[];
/** 该模板是否可通过指定渠道分发 */
export declare function hasChannel(tpl: CouponChannelFields | null | undefined, hasProductBinding: boolean, channel: CouponChannel): boolean;
/**
 * 场景匹配：ALL 同时匹配线上与到店；null / undefined 按 ONLINE 处理（历史数据语义）。
 */
export declare function matchesScene(usageScene: string | null | undefined, scene: CouponUsageScene): boolean;
/**
 * 列表精筛：仅保留「渠道命中 + 场景命中」的模板。
 * 用于各 C 端渠道查询在 SQL 粗筛之后做精确过滤。
 */
export declare function filterTemplatesByChannelAndScene<T extends CouponChannelFields>(templates: T[], channel: CouponChannel, scene: CouponUsageScene): T[];
