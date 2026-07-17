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
exports.FeaturesCollector = void 0;
const common_1 = require("@nestjs/common");
const transactional_connection_1 = require("../../connection/transactional-connection");
const api_key_entity_1 = require("../../entity/api-key/api-key.entity");
const channel_entity_1 = require("../../entity/channel/channel.entity");
const seller_entity_1 = require("../../entity/seller/seller.entity");
const stock_location_entity_1 = require("../../entity/stock-location/stock-location.entity");
/**
 * Collects feature adoption flags for telemetry.
 * DB-dependent flags are resolved in parallel. Each flag is derived
 * independently so a single failure does not affect the others.
 *
 * Config-derived flags (`customFieldsInUse`, `scheduledTasks`) are read
 * from the already-collected `TelemetryConfig` to avoid duplicating
 * iteration logic that lives in `ConfigCollector`.
 */
let FeaturesCollector = class FeaturesCollector {
    constructor(connection) {
        this.connection = connection;
    }
    async collect(config) {
        var _a, _b;
        const rawConnection = this.connection.rawConnection;
        const dbReady = rawConnection === null || rawConnection === void 0 ? void 0 : rawConnection.isInitialized;
        // Run all DB queries in parallel — they are independent
        const [multiChannel, sellerCount, multiStockLocation, apiKeysEnabled] = await Promise.all([
            this.safeCount(dbReady, channel_entity_1.Channel, count => count > 1),
            this.safeCount(dbReady, seller_entity_1.Seller, count => count),
            this.safeCount(dbReady, stock_location_entity_1.StockLocation, count => count > 1),
            this.safeCount(dbReady, api_key_entity_1.ApiKey, count => count > 0),
        ]);
        return {
            multiChannel,
            multiVendor: this.deriveMultiVendor(sellerCount, dbReady, config),
            multiStockLocation,
            apiKeysEnabled,
            // Derived from already-collected config — no duplicate iteration
            customFieldsInUse: ((_a = config.customFieldsCount) !== null && _a !== void 0 ? _a : 0) > 0,
            scheduledTasks: ((_b = config.scheduledTaskCount) !== null && _b !== void 0 ? _b : 0) > 0,
        };
    }
    /**
     * Derives multiVendor from seller count + strategy name.
     * When DB is unavailable, returns `undefined` to stay consistent
     * with other DB-dependent flags — the strategy check alone is
     * not authoritative enough to report a definitive value.
     */
    deriveMultiVendor(sellerCount, dbReady, config) {
        var _a;
        try {
            if (!dbReady)
                return undefined;
            const multipleSellers = sellerCount !== undefined && sellerCount > 1;
            const strategyName = (_a = config.orderSellerStrategy) !== null && _a !== void 0 ? _a : 'unknown';
            const customStrategy = strategyName !== 'DefaultOrderSellerStrategy' && strategyName !== 'unknown';
            return multipleSellers || customStrategy;
        }
        catch (_b) {
            return undefined;
        }
    }
    // eslint-disable-next-line @typescript-eslint/ban-types
    async safeCount(dbReady, entity, map) {
        try {
            if (!dbReady)
                return undefined;
            const count = await this.connection.rawConnection.getRepository(entity).count();
            return map(count);
        }
        catch (_a) {
            return undefined;
        }
    }
};
exports.FeaturesCollector = FeaturesCollector;
exports.FeaturesCollector = FeaturesCollector = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [transactional_connection_1.TransactionalConnection])
], FeaturesCollector);
//# sourceMappingURL=features.collector.js.map