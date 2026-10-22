/**
 * 外卖履约矩阵（唯一事实来源）：R1–R5 × 店铺「按路线第一段承运」配置 → RoutePlan
 *
 * 结构由路线决定，承运由配置决定：
 * - R1 商户/自营快递→校园交接点，传信者接力上楼（接力固定）
 * - R2 外部快递→校园交接点，传信者接力（接力固定，承运固定）
 * - R3 传信者/自营快递/外部快递到档口取餐直送（一段到底）
 * - R4 到店自取
 * - R5 校园跑腿
 *
 * R6 已取消，不在此矩阵内。
 */
export declare const CAMPUS_ROUTES: readonly ["R1", "R2", "R3", "R4", "R5"];
export type CampusRoute = (typeof CAMPUS_ROUTES)[number];
export type DeliveryPlan = 'campus_rider' | 'external_courier' | 'owned' | 'merchant' | 'self_pickup';
export type HandoverMode = 'to_campus_rider' | 'direct_to_user';
export type RouteFirstLeg = 'merchant' | 'owned' | 'campus' | 'external';
export type ExternalProviderCode = 'dada' | 'meituan';
/** 派单策略：调用方据此分流到不同处理器 */
export type DispatchStrategy = 'merchant_pool' | 'external_push' | 'hall_grab' | 'pickup' | 'errand';
/** 各路线允许的第一段承运方 */
export declare const ROUTE_FIRST_LEG_OPTIONS: Record<CampusRoute, readonly string[]>;
/** 默认第一段：R1 商户，R3 传信者 */
export declare const ROUTE_FIRST_LEG_DEFAULTS: Partial<Record<CampusRoute, RouteFirstLeg>>;
export interface HandoverPointConfig {
    name: string;
    address?: string;
    phone?: string;
    lat: number;
    lng: number;
}
export interface RouteConfig {
    /** 按路线配置第一段承运方（只有 R1/R3 生效），未配置用默认值 */
    routeFirstLeg?: Record<string, string> | null;
    /** 校园交接点：R1/R2 各一个 */
    handoverPoints?: Record<string, HandoverPointConfig> | null;
    storeAddress?: string | null;
    storePhone?: string | null;
    storeLat?: number | null;
    storeLng?: number | null;
    merchantAcceptMinutes?: number | null;
}
export interface RoutePlan {
    route: CampusRoute;
    /** 第一段承运 */
    leg1: DeliveryPlan;
    /** 第二段：仅接力路线有 */
    leg2: 'campus_rider' | 'none';
    handover: HandoverMode | null;
    /** 仅 leg1=external_courier 时有值；由运营中心派单时决定 */
    externalProvider: ExternalProviderCode | null;
    dispatch: DispatchStrategy;
}
export interface GeoPointLike {
    name: string;
    address?: string;
    lat: number;
    lng: number;
    phone?: string;
}
/** 校验并归一某条路线的第一段承运方；不合法返回 null */
export declare function normalizeRouteFirstLeg(route: string, value: string | null | undefined): RouteFirstLeg | null;
export declare function resolveRoutePlan(route: string, cfg: RouteConfig, externalProvider?: ExternalProviderCode | null): RoutePlan | null;
/** 取货点：店铺经纬度（档口/门店）；缺坐标返回 null，禁止用 (0,0) 派单 */
export declare function resolvePickup(_route: CampusRoute, cfg: RouteConfig): GeoPointLike | null;
/** 该路线配置的交接点（未配置返回 null，由调用方报「未配置交接点」） */
export declare function resolveHandoverPoint(route: CampusRoute, cfg: RouteConfig): GeoPointLike | null;
/** 外部快递的收货点：R1/R2 打本路线交接点；R3 直送打用户地址；R4 无配送 */
export declare function resolveDropoff(route: CampusRoute, plan: RoutePlan, cfg: RouteConfig, userPoint: GeoPointLike): GeoPointLike | null;
