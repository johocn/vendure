import { StockLocation } from '@vendure/core';
export declare const loggerCtx = "MatrixStockLocationStrategy";
/** 会员等级专属规则项 */
export interface MemberStockRule {
    level: string;
    locationIds: string[];
    fallback: 'nearest' | 'priority' | 'stock-first';
}
/** 订单级地理锚点（复用就近逻辑输入） */
export interface OrderGeoAnchor {
    lat: number | null;
    lng: number | null;
}
/** 按距离升序 */
export declare function rankByNearest(locations: StockLocation[], anchor: OrderGeoAnchor): StockLocation[];
/** 按 stockLocationPriority JSON priority 升序 */
export declare function rankByPriority(locations: StockLocation[], priorityConfig: Array<{
    locationId: string;
    priority: number;
}>): StockLocation[];
/** 按库存 onHand 降序 */
export declare function rankByStockFirst(locations: StockLocation[], stockOnHandMap: Map<string, number>): StockLocation[];
/** 会员专属：命中仓按 locationIds 顺序前置，其余按 fallback 规则排序 */
export declare function rankByMemberRule(locations: StockLocation[], rule: MemberStockRule, priorityConfig: Array<{
    locationId: string;
    priority: number;
}>, stockOnHandMap: Map<string, number>, anchor: OrderGeoAnchor): StockLocation[];
/** 解析 channel 级 stockLocationPriority JSON，容错返回 [] */
export declare function parsePriorityConfig(raw: unknown): Array<{
    locationId: string;
    priority: number;
}>;
/** 解析 channel 级 memberStockStrategy JSON，容错返回 [] */
export declare function parseMemberRules(raw: unknown): MemberStockRule[];
