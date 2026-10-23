import { ID, ShippingCalculator, TransactionalConnection } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
export declare function bindCampusErrandCalculatorConnection(conn: TransactionalConnection): void;
/** 大厅待抢单量（30s 缓存）；动态计价预览与运费报价共用同一口径 */
export declare function readHallBacklog(conn: TransactionalConnection, channelId: ID): Promise<number>;
export declare const campusErrandCalculator: ShippingCalculator<{}>;
/** 运费口径：分区配送 / 跑腿起步价 / 第三方到校配基价 */
export type CampusFeeScope = 'zone' | 'errand' | 'third-party';
/**
 * 非分区基价的动态报价（R5 跑腿起步价、R2 第三方到校基价复用）。
 * 满额免配送费不参与（门槛仅针对 R1/R3 外卖单），加价规则与分区运费一致。
 */
export declare function quoteDynamicBaseFee(conn: TransactionalConnection, channelId: ID, baseFee: number, cfg: CampusFulfillmentConfig | null | undefined, scope: Exclude<CampusFeeScope, 'zone'>): Promise<{
    price: number;
    priceIncludesTax: boolean;
    taxRate: number;
    metadata: {
        calculator: string;
        scope: "errand" | "third-party";
        baseFee: number;
        addFee: number;
        breakdown: import("./dynamic-pricing").PricingBreakdownItem[];
        pricing: string;
    };
}>;
/** 分区运费报价（改址差额也复用此函数，保证前后口径一致） */
export declare function quoteZoneFee(conn: TransactionalConnection, channelId: ID, zone: {
    name: string;
    fee: number;
}, cfg: CampusFulfillmentConfig | null | undefined, order: {
    subTotalWithTax?: number;
    subTotal?: number;
}): Promise<{
    price: number;
    priceIncludesTax: boolean;
    taxRate: number;
    metadata: {
        zoneName: string;
        calculator: string;
        freeShipping: boolean;
        originalPrice: number;
        threshold: number;
        baseFee?: undefined;
        addFee?: undefined;
        breakdown?: undefined;
        pricing?: undefined;
    };
} | {
    price: number;
    priceIncludesTax: boolean;
    taxRate: number;
    metadata: {
        zoneName: string;
        calculator: string;
        baseFee: number;
        addFee: number;
        breakdown: import("./dynamic-pricing").PricingBreakdownItem[];
        pricing: string;
        freeShipping?: undefined;
        originalPrice?: undefined;
        threshold?: undefined;
    };
}>;
