export type DeliveryMethod = 'MAIL' | 'SELF_PICKUP';
export interface LocationLike {
    customFields?: {
        deliveryMethods?: Array<string | null> | null;
    } | null;
}
/** 网点是否支持某配送方式。deliveryMethods 空/未配置 = 兼容旧数据，两者都支持。 */
export declare function locationSupports(loc: LocationLike | null | undefined, method: DeliveryMethod): boolean;
/** 按请求配送方式过滤网点候选。请求为空 = 不做过滤（全放行）。 */
export declare function filterLocationsByDelivery<T extends LocationLike>(locations: T[], requested: DeliveryMethod[]): T[];
