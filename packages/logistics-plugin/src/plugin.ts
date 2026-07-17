import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { LOGISTICS_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { LogisticsPluginOptions } from './types';
import { logisticsFulfillmentCustomFields } from './fulfillment-custom-fields';
import { logisticsChannelCustomFields } from './channel-custom-fields';
import { ChannelStockAllocationStrategy } from './channel-stock-allocation-strategy';
import { LogisticsTrack } from './logistics-track.entity';
import { LogisticsService } from './logistics.service';
import { LogisticsAdminResolver } from './logistics-admin.resolver';
import { LogisticsShopResolver } from './logistics-shop.resolver';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
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

const shopSchema = () => gql`
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

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [LogisticsTrack],
    providers: [
        { provide: LOGISTICS_PLUGIN_OPTIONS, useFactory: () => LogisticsPlugin.options },
        LogisticsService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [LogisticsAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [LogisticsShopResolver],
    },
    configuration: (config) => {
        config.customFields.Fulfillment = [
            ...(config.customFields.Fulfillment ?? []),
            ...logisticsFulfillmentCustomFields.Fulfillment!,
        ];
        config.customFields.Channel = [
            ...(config.customFields.Channel ?? []),
            ...logisticsChannelCustomFields.Channel!,
        ];
        config.orderOptions.stockAllocationStrategy = new ChannelStockAllocationStrategy();
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class LogisticsPlugin implements OnApplicationBootstrap {
    private static options: LogisticsPluginOptions = {};
    private injector: Injector;

    constructor(
        @Inject(LOGISTICS_PLUGIN_OPTIONS) private options: LogisticsPluginOptions,
        private logisticsService: LogisticsService,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin> {
        LogisticsPlugin.options = options ?? {};
        return LogisticsPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.logisticsService.init(this.injector);
        Logger.info('LogisticsPlugin initialized', loggerCtx);
    }
}
