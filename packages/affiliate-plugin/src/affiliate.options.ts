export const AFFILIATE_PLUGIN_OPTIONS = Symbol('AFFILIATE_PLUGIN_OPTIONS');

export const AFFILIATE_DEFAULT_RATE = 30; // 3%，千分比（全局默认分销佣金率）
export const AFFILIATE_DEFAULT_LOAD_ON = 'platform' as const;

export interface AffiliatePluginOptions {
    /** 千分比，全局默认分销佣金率。 */
    defaultRate?: number;
    /** 佣金负载方：merchant(店主) | platform(平台)。 */
    defaultLoadOn?: 'merchant' | 'platform';
}