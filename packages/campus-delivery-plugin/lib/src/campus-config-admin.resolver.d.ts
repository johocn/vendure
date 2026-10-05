import { ID, RequestContext } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { ErrandService } from './errand.service';
export declare class CampusConfigAdminResolver {
    private config;
    private errand;
    constructor(config: CampusConfigService, errand: ErrandService);
    campusZones(ctx: RequestContext): Promise<import("./campus-zone.entity").CampusZone[]>;
    campusBuildings(ctx: RequestContext, zoneId?: ID): Promise<import("./campus-building.entity").CampusBuilding[]>;
    campusConfig(ctx: RequestContext): Promise<import("./campus-fulfillment-config.entity").CampusFulfillmentConfig>;
    campusCreateZone(ctx: RequestContext, name: string, fee: number): Promise<any>;
    campusCreateBuilding(ctx: RequestContext, name: string, zoneId: ID, detail?: string): Promise<any>;
    campusUpdateConfig(ctx: RequestContext, input: any): Promise<import("./campus-fulfillment-config.entity").CampusFulfillmentConfig>;
    campusCreateSlot(ctx: RequestContext, input: any): Promise<any>;
    campusUpdateSlot(ctx: RequestContext, id: number, input: any): Promise<import("./delivery-slot.entity").DeliverySlot>;
    campusSlots(ctx: RequestContext): Promise<import("./delivery-slot.entity").DeliverySlot[]>;
    /** R5 跑腿单：幂等创建 0 元载体商品（SKU 查重），C 端 addItemToOrder 用其 variantId */
    campusEnsureErrandProducts(ctx: RequestContext): Promise<{
        variantId: ID;
        sku: string;
    }>;
}
