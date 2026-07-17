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
exports.DatabaseCollector = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../../config/config.service");
const transactional_connection_1 = require("../../connection/transactional-connection");
const entities_1 = require("../../entity/entities");
const range_bucket_helper_1 = require("../helpers/range-bucket.helper");
/**
 * Collects database type and entity metrics for telemetry.
 */
let DatabaseCollector = class DatabaseCollector {
    constructor(configService, connection) {
        this.configService = configService;
        this.connection = connection;
    }
    async collect() {
        const databaseType = this.getDatabaseType();
        let metrics;
        try {
            metrics = await this.collectEntityMetrics();
        }
        catch (_a) {
            metrics = { entities: {}, custom: { entityCount: 0 } };
        }
        return {
            databaseType,
            metrics,
        };
    }
    getDatabaseType() {
        const dbType = this.configService.dbConnectionOptions.type;
        if (dbType === 'better-sqlite3' || dbType === 'sqlite') {
            return 'sqlite';
        }
        if (dbType === 'postgres' || dbType === 'mysql' || dbType === 'mariadb') {
            return dbType;
        }
        return 'other';
    }
    async collectEntityMetrics() {
        // Check if connection is ready before attempting to collect metrics
        const rawConnection = this.connection.rawConnection;
        if (!(rawConnection === null || rawConnection === void 0 ? void 0 : rawConnection.isInitialized)) {
            return { entities: {}, custom: { entityCount: 0 } };
        }
        const coreEntityEntries = Object.entries(entities_1.coreEntitiesMap);
        const counts = await Promise.all(coreEntityEntries.map(([, entity]) => this.safeCount(entity)));
        const entities = {};
        coreEntityEntries.forEach(([name], index) => {
            entities[name] = (0, range_bucket_helper_1.toRangeBucket)(counts[index]);
        });
        const customEntities = this.getCustomEntities();
        const customEntityCount = customEntities.length;
        // Only count custom entity records if there are custom entities
        let totalCustomRecords;
        if (customEntityCount > 0) {
            const customCounts = await Promise.all(customEntities.map(entity => this.safeCount(entity)));
            totalCustomRecords = customCounts.reduce((sum, count) => sum + count, 0);
        }
        return {
            entities,
            custom: Object.assign({ entityCount: customEntityCount }, (totalCustomRecords !== undefined && { totalRecords: (0, range_bucket_helper_1.toRangeBucket)(totalCustomRecords) })),
        };
    }
    // eslint-disable-next-line @typescript-eslint/ban-types
    async safeCount(entity) {
        try {
            const rawConnection = this.connection.rawConnection;
            if (!(rawConnection === null || rawConnection === void 0 ? void 0 : rawConnection.isInitialized)) {
                return 0;
            }
            return await rawConnection.getRepository(entity).count();
        }
        catch (_a) {
            return 0;
        }
    }
    // eslint-disable-next-line @typescript-eslint/ban-types
    getCustomEntities() {
        const entities = this.configService.dbConnectionOptions.entities;
        if (!Array.isArray(entities)) {
            return [];
        }
        const coreEntityNames = new Set(Object.keys(entities_1.coreEntitiesMap));
        // eslint-disable-next-line @typescript-eslint/ban-types
        const customEntities = [];
        for (const entity of entities) {
            if (typeof entity === 'function') {
                const entityName = entity.name;
                if (!coreEntityNames.has(entityName)) {
                    customEntities.push(entity);
                }
            }
        }
        return customEntities;
    }
};
exports.DatabaseCollector = DatabaseCollector;
exports.DatabaseCollector = DatabaseCollector = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        transactional_connection_1.TransactionalConnection])
], DatabaseCollector);
//# sourceMappingURL=database.collector.js.map