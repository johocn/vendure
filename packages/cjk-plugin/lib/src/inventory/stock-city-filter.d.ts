import type { ID } from '@vendure/core';
/** 仓库 serviceCities 是否服务目标城市：未配置或空数组视为全城可服务；
 *  匹配含精确、包含、前后缀（与 inventory-plugin locationServesCity 同语义）。 */
export declare function cityServes(serviceCities: unknown, city: string): boolean;
export interface CityStockLevel {
    stockLocationId: ID;
    stockOnHand: number;
}
export interface BindRef {
    locationId: ID;
}
export interface CityPin {
    servedLocations: ID[];
    servedOnHand: number;
}
/** 按城市聚合绑定物理仓可售：city 为空 → 全部绑定仓合计；否则仅过滤可服务仓。
 *  无任何可服务仓返回空 servedLocations + onHand=0（由调用方决定回退虚拟仓）。 */
export declare function pinByCity(levels: CityStockLevel[], bindings: BindRef[], cities: Map<string, unknown>, city: string | null | undefined): CityPin;
