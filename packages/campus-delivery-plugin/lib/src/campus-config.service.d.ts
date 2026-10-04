import { RequestContext } from '@vendure/core';
import { DataSource } from 'typeorm';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
export declare class CampusConfigService {
    private dataSource;
    constructor(dataSource: DataSource);
    listZones(ctx: RequestContext): Promise<CampusZone[]>;
    createZone(ctx: RequestContext, name: string, fee: number): Promise<any>;
    listBuildings(zoneId?: number): Promise<CampusBuilding[]>;
    createBuilding(ctx: RequestContext, name: string, zoneId: number, detail?: string): Promise<any>;
    getConfig(ctx: RequestContext): Promise<CampusFulfillmentConfig>;
    updateConfig(ctx: RequestContext, patch: Partial<CampusFulfillmentConfig>): Promise<CampusFulfillmentConfig>;
}
