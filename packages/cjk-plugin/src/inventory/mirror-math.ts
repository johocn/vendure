import { ID } from '@vendure/core';

export interface StockLevelLike {
    locationId: ID;
    onHand: number;
}

export function sumBoundOnHand(levels: StockLevelLike[], boundLocationIds: ID[]): number {
    const set = new Set(boundLocationIds.map(String));
    return levels.reduce((sum, l) => (set.has(String(l.locationId)) ? sum + l.onHand : sum), 0);
}

export function calcMirrorDelta(currentVirtual: number, boundTotal: number): number {
    return boundTotal - currentVirtual;
}

export function pickLocationsByIds<T extends { id: ID }>(locations: T[], ids: ID[]): T[] {
    const set = new Set(ids.map(String));
    return locations.filter(l => set.has(String(l.id)));
}

/** 地球半径 km，Haversine 公式（与 inventory.service.locationDistanceKm 同源） */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
