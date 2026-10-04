"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusConfigService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
let CampusConfigService = class CampusConfigService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    listZones(ctx) {
        return this.dataSource.getRepository(campus_zone_entity_1.CampusZone).find({ where: { channelId: ctx.channelId } });
    }
    async createZone(ctx, name, fee) {
        return this.dataSource.getRepository(campus_zone_entity_1.CampusZone).save({ name, fee, channelId: ctx.channelId });
    }
    listBuildings(zoneId) {
        return this.dataSource
            .getRepository(campus_building_entity_1.CampusBuilding)
            .find(zoneId ? { where: { zoneId } } : {});
    }
    async createBuilding(ctx, name, zoneId, detail) {
        return this.dataSource
            .getRepository(campus_building_entity_1.CampusBuilding)
            .save({ name, zoneId, detail, channelId: ctx.channelId });
    }
    async getConfig(ctx) {
        const repo = this.dataSource.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig);
        let cfg = await repo.findOne({ where: { channelId: ctx.channelId } });
        if (!cfg) {
            // 显式写入默认值（与实体列默认值一致），保证内存对象与 DB 默认一致
            cfg = await repo.save(new campus_fulfillment_config_entity_1.CampusFulfillmentConfig({
                channelId: ctx.channelId,
                routesEnabled: ['R1', 'R3', 'R4', 'R5'],
                riderCommissionRate: 100,
                autoAssignMinutes: 10,
                paused: false,
            }));
        }
        return cfg;
    }
    async updateConfig(ctx, patch) {
        const cfg = await this.getConfig(ctx);
        Object.assign(cfg, patch);
        return this.dataSource.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).save(cfg);
    }
};
exports.CampusConfigService = CampusConfigService;
exports.CampusConfigService = CampusConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], CampusConfigService);
//# sourceMappingURL=campus-config.service.js.map