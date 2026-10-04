import { ID, RequestContext } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
export declare class CampusConfigAdminResolver {
    private config;
    constructor(config: CampusConfigService);
    campusZones(ctx: RequestContext): Promise<import("./campus-zone.entity").CampusZone[]>;
    campusBuildings(ctx: RequestContext, zoneId?: ID): Promise<import("./campus-building.entity").CampusBuilding[]>;
    campusConfig(ctx: RequestContext): Promise<import("./campus-fulfillment-config.entity").CampusFulfillmentConfig>;
    campusCreateZone(ctx: RequestContext, name: string, fee: number): Promise<any>;
    campusCreateBuilding(ctx: RequestContext, name: string, zoneId: ID, detail?: string): Promise<any>;
    campusUpdateConfig(ctx: RequestContext, input: any): Promise<import("./campus-fulfillment-config.entity").CampusFulfillmentConfig>;
}
