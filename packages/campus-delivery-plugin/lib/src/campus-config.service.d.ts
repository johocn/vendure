import { OrderService, RequestContext } from '@vendure/core';
import { DataSource } from 'typeorm';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { DeliverySlot } from './delivery-slot.entity';
export declare class CampusConfigService {
    private dataSource;
    private orderService;
    constructor(dataSource: DataSource, orderService: OrderService);
    listZones(ctx: RequestContext): Promise<CampusZone[]>;
    createZone(ctx: RequestContext, name: string, fee: number): Promise<any>;
    listBuildings(zoneId?: number): Promise<CampusBuilding[]>;
    createBuilding(ctx: RequestContext, name: string, zoneId: number, detail?: string): Promise<any>;
    getConfig(ctx: RequestContext): Promise<CampusFulfillmentConfig>;
    updateConfig(ctx: RequestContext, patch: Partial<CampusFulfillmentConfig>): Promise<CampusFulfillmentConfig>;
    createSlot(ctx: RequestContext, input: {
        slotDate: string;
        startTime: string;
        endTime: string;
        zoneId?: number;
        capacity?: number;
    }): Promise<any>;
    updateSlot(ctx: RequestContext, id: number, patch: {
        capacity?: number;
        active?: boolean;
        startTime?: string;
        endTime?: string;
    }): Promise<DeliverySlot>;
    listSlots(ctx: RequestContext): Promise<DeliverySlot[]>;
    /** C 端可订时段：active 且未过期，带余量 */
    slotsForShop(ctx: RequestContext): Promise<{
        remaining: number;
        slotDate: string;
        startTime: string;
        endTime: string;
        zoneId: import("@vendure/core").ID;
        capacity: number;
        lockedCount: number;
        active: boolean;
        channelId: import("@vendure/core").ID;
        id: import("@vendure/core").ID;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    /** C 端选楼/选区/选路线/选时段写入 activeOrder。
     * route/slot 可选（向后兼容 plan2 旧调用形态）；route 为 R1/R2/R3；R2 的到校确认走 r2-mark 链路。 */
    setDeliveryTarget(ctx: RequestContext, zoneId: number, buildingId: number, route?: 'R1' | 'R2' | 'R3', slotId?: number): Promise<import("@vendure/core").Order>;
}
