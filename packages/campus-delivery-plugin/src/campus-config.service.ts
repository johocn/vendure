import { Injectable } from '@nestjs/common';
import { RequestContext } from '@vendure/core';
import { DataSource } from 'typeorm';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';

@Injectable()
export class CampusConfigService {
    constructor(private dataSource: DataSource) {}

    listZones(ctx: RequestContext) {
        return this.dataSource.getRepository(CampusZone).find({ where: { channelId: ctx.channelId as any } });
    }

    async createZone(ctx: RequestContext, name: string, fee: number) {
        return this.dataSource.getRepository(CampusZone).save({ name, fee, channelId: ctx.channelId } as any);
    }

    listBuildings(zoneId?: number) {
        return this.dataSource
            .getRepository(CampusBuilding)
            .find(zoneId ? { where: { zoneId } } : {});
    }

    async createBuilding(ctx: RequestContext, name: string, zoneId: number, detail?: string) {
        return this.dataSource
            .getRepository(CampusBuilding)
            .save({ name, zoneId, detail, channelId: ctx.channelId } as any);
    }

    async getConfig(ctx: RequestContext): Promise<CampusFulfillmentConfig> {
        const repo = this.dataSource.getRepository(CampusFulfillmentConfig);
        let cfg = await repo.findOne({ where: { channelId: ctx.channelId as any } });
        if (!cfg) {
            // 显式写入默认值（与实体列默认值一致），保证内存对象与 DB 默认一致
            cfg = await repo.save(
                new CampusFulfillmentConfig({
                    channelId: ctx.channelId,
                    routesEnabled: ['R1', 'R3', 'R4', 'R5'],
                    riderCommissionRate: 100,
                    autoAssignMinutes: 10,
                    paused: false,
                } as any),
            );
        }
        return cfg;
    }

    async updateConfig(ctx: RequestContext, patch: Partial<CampusFulfillmentConfig>) {
        const cfg = await this.getConfig(ctx);
        Object.assign(cfg, patch);
        return this.dataSource.getRepository(CampusFulfillmentConfig).save(cfg);
    }
}
