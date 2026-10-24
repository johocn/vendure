/**
 * 动态配送计价（纯函数，便于单测）。
 * 计费 = 分区基价 + 时段高峰加价 + 供需紧张加价 + 手动倍率加价，单笔加价封顶。
 * 满额免配送费在 calculator 层先判定（达标直接 0），不进入本函数。
 */
export interface PeakWindow {
    label?: string;
    start: string;
    end: string;
    addFee: number;
}
export interface SupplyRule {
    backlogThreshold: number;
    riderThreshold?: number | null;
    addFee: number;
    releaseBacklog?: number | null;
    releaseRiders?: number | null;
}
export interface DynamicPricingConfig {
    enabled: boolean;
    peakWindows: PeakWindow[];
    supply: SupplyRule | null;
    manualMultiplier: number;
    maxAddFee: number;
}
export declare const DEFAULT_DYNAMIC_PRICING: DynamicPricingConfig;
export interface PricingBreakdownItem {
    key: 'peak' | 'supply' | 'multiplier';
    label: string;
    fee: number;
}
export interface DynamicQuote {
    price: number;
    baseFee: number;
    addFee: number;
    breakdown: PricingBreakdownItem[];
}
/** 宽松解析后台 JSON：坏值/缺字段一律回退默认，避免坏配置阻断结算 */
export declare function parseDynamicPricing(raw: unknown): DynamicPricingConfig;
export declare function quoteDynamicFee(args: {
    baseFee: number;
    config: DynamicPricingConfig;
    at: Date;
    backlog: number;
    onlineRiders?: number;
}): DynamicQuote;
