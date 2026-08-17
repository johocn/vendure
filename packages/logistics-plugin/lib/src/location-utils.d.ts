/**
 * 地理工具：用于「就近发货」策略计算仓库/门店与订单定位的距离。
 */
export interface GeoPoint {
    lat: number;
    lng: number;
}
/**
 * 返回两点之间的球面距离（单位：公里，haversine 公式）。
 * 若任一坐标非法，返回 +Infinity，使该锚点自然排在最后。
 */
export declare function distanceKm(a: GeoPoint, b: GeoPoint): number;
