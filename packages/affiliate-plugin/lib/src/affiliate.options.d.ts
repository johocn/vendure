export declare const AFFILIATE_PLUGIN_OPTIONS: unique symbol;
export declare const AFFILIATE_DEFAULT_RATE = 30;
export declare const AFFILIATE_DEFAULT_LOAD_ON: "platform";
export interface AffiliatePluginOptions {
    /** 千分比，全局默认分销佣金率。 */
    defaultRate?: number;
    /** 佣金负载方：merchant(店主) | platform(平台)。 */
    defaultLoadOn?: 'merchant' | 'platform';
}
