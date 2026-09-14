import { ID } from '@vendure/core';
export interface StockLevelLike {
    locationId: ID;
    onHand: number;
}
export declare function sumBoundOnHand(levels: StockLevelLike[], boundLocationIds: ID[]): number;
export declare function calcMirrorDelta(currentVirtual: number, boundTotal: number): number;
export declare function pickLocationsByIds<T extends {
    id: ID;
}>(locations: T[], ids: ID[]): T[];
/** 地球半径 km，Haversine 公式（与 inventory.service.locationDistanceKm 同源） */
export declare function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
