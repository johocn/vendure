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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LogisticsPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const fulfillment_custom_fields_1 = require("./fulfillment-custom-fields");
const channel_custom_fields_1 = require("./channel-custom-fields");
const channel_stock_allocation_strategy_1 = require("./channel-stock-allocation-strategy");
const catalog_custom_fields_1 = require("./catalog-custom-fields");
const nearest_stock_location_strategy_1 = require("./nearest-stock-location-strategy");
const logistics_track_entity_1 = require("./logistics-track.entity");
const logistics_service_1 = require("./logistics.service");
const logistics_admin_resolver_1 = require("./logistics-admin.resolver");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const logistics_shop_resolver_1 = require("./logistics-shop.resolver");
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
    type LogisticsTrack implements Node {
        id: ID!
        fulfillmentId: ID!
        trackingNo: String!
        carrierCode: String!
        carrierName: String!
        status: String!
        trackInfo: String
        signedAt: DateTime
        lastSyncedAt: DateTime
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type Carrier {
        code: String!
        name: String!
        shortName: String!
    }

    input BatchFulfillmentItem {
        orderId: ID!
        trackingNo: String!
        carrierCode: String!
    }

    type BatchFulfillmentItemResult {
        orderId: ID!
        success: Boolean!
        trackId: ID
        error: String
    }

    type BatchFulfillmentResult {
        items: [BatchFulfillmentItemResult!]!
    }

    extend type Query {
        logisticsTracks(orderId: ID!): [LogisticsTrack!]!
        logisticsTrack(id: ID!): LogisticsTrack
        carriers: [Carrier!]!
    }

    extend type Mutation {
        batchCreateFulfillment(items: [BatchFulfillmentItem!]!): BatchFulfillmentResult!
        refreshTrack(id: ID!): LogisticsTrack!
    }
`;
const shopSchema = () => gql `
    type LogisticsTrackShop {
        id: ID!
        fulfillmentId: ID!
        trackingNo: String!
        carrierCode: String!
        carrierName: String!
        status: String!
        trackInfo: String
        signedAt: DateTime
        lastSyncedAt: DateTime
    }

    extend type Query {
        myOrderTracks(orderId: ID!): [LogisticsTrackShop!]!
    }
`;
let LogisticsPlugin = LogisticsPlugin_1 = class LogisticsPlugin {
    constructor(options, logisticsService, moduleRef) {
        this.options = options;
        this.logisticsService = logisticsService;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        LogisticsPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return LogisticsPlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.logisticsService.init(this.injector);
        core_2.Logger.info('LogisticsPlugin initialized', constants_1.loggerCtx);
    }
};
exports.LogisticsPlugin = LogisticsPlugin;
LogisticsPlugin.options = {};
exports.LogisticsPlugin = LogisticsPlugin = LogisticsPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [logistics_track_entity_1.LogisticsTrack],
        providers: [
            { provide: constants_1.LOGISTICS_PLUGIN_OPTIONS, useFactory: () => LogisticsPlugin.options },
            logistics_service_1.LogisticsService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [logistics_admin_resolver_1.LogisticsAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [logistics_shop_resolver_1.LogisticsShopResolver],
        },
        configuration: (config) => {
            config.customFields.Fulfillment = mergeCustomFields(config.customFields.Fulfillment, fulfillment_custom_fields_1.logisticsFulfillmentCustomFields.Fulfillment);
            config.customFields.Channel = mergeCustomFields(config.customFields.Channel, channel_custom_fields_1.logisticsChannelCustomFields.Channel);
            config.customFields.Product = mergeCustomFields(config.customFields.Product, catalog_custom_fields_1.catalogCustomFields.Product);
            config.customFields.StockLocation = mergeCustomFields(config.customFields.StockLocation, catalog_custom_fields_1.catalogCustomFields.StockLocation);
            config.customFields.Order = mergeCustomFields(config.customFields.Order, catalog_custom_fields_1.catalogCustomFields.Order);
            config.orderOptions.stockAllocationStrategy = new channel_stock_allocation_strategy_1.ChannelStockAllocationStrategy();
            // 就近发货：覆写仓库/门店分配策略（真正的按订单定位就近）
            config.catalogOptions.stockLocationStrategy = new nearest_stock_location_strategy_1.NearestStockLocationStrategy();
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.LOGISTICS_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, logistics_service_1.LogisticsService,
        core_1.ModuleRef])
], LogisticsPlugin);
//# sourceMappingURL=plugin.js.map