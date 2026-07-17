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
const logistics_track_entity_1 = require("./logistics-track.entity");
const logistics_service_1 = require("./logistics.service");
const logistics_admin_resolver_1 = require("./logistics-admin.resolver");
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
            var _a, _b;
            config.customFields.Fulfillment = [
                ...((_a = config.customFields.Fulfillment) !== null && _a !== void 0 ? _a : []),
                ...fulfillment_custom_fields_1.logisticsFulfillmentCustomFields.Fulfillment,
            ];
            config.customFields.Channel = [
                ...((_b = config.customFields.Channel) !== null && _b !== void 0 ? _b : []),
                ...channel_custom_fields_1.logisticsChannelCustomFields.Channel,
            ];
            config.orderOptions.stockAllocationStrategy = new channel_stock_allocation_strategy_1.ChannelStockAllocationStrategy();
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