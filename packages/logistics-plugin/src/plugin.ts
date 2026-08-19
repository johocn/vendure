import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { LOGISTICS_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { LogisticsPluginOptions } from './types';
import { logisticsFulfillmentCustomFields } from './fulfillment-custom-fields';
import { logisticsChannelCustomFields } from './channel-custom-fields';
import { ChannelStockAllocationStrategy } from './channel-stock-allocation-strategy';
import { catalogCustomFields } from './catalog-custom-fields';
import { MatrixStockLocationStrategy } from './matrix-stock-location-strategy';
import { LogisticsTrack } from './logistics-track.entity';
import { LogisticsService } from './logistics.service';
import { LogisticsAdminResolver } from './logistics-admin.resolver';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { SplitAdminResolver } from './split-admin.resolver';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}
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
        splitPlanPreview(orderId: ID!): OrderSplitPlan!
    }

    extend type Mutation {
        batchCreateFulfillment(items: [BatchFulfillmentItem!]!): BatchFulfillmentResult!
        refreshTrack(id: ID!): LogisticsTrack!
        confirmSplitPlan(orderId: ID!, packages: [SplitPackageInput!]!): OrderSplitPlan!
    }

    input SplitLineInput { orderLineId: ID!, quantity: Int! }
    input SplitPackageInput { stockLocationId: ID!, lines: [SplitLineInput!]! }
    type SplitLine { orderLineId: ID!, quantity: Int! }
    type SplitPackage { packageId: String!, stockLocationId: ID!, lines: [SplitLine!]!, estimatedShippingFee: Float!, deliveryMode: String! }
    type OrderSplitPlan { orderId: ID!, packages: [SplitPackage!]! }
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
        AutoSplitPlanService,
        ManualSplitAdjustService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [LogisticsAdminResolver, SplitAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [LogisticsShopResolver],
    },
    configuration: (config) => {
        config.customFields.Fulfillment = mergeCustomFields(config.customFields.Fulfillment, logisticsFulfillmentCustomFields.Fulfillment);
        config.customFields.Channel = mergeCustomFields(config.customFields.Channel, logisticsChannelCustomFields.Channel);
        config.customFields.Product = mergeCustomFields(config.customFields.Product, catalogCustomFields.Product);
        config.customFields.StockLocation = mergeCustomFields(config.customFields.StockLocation, catalogCustomFields.StockLocation);
        config.customFields.Order = mergeCustomFields(config.customFields.Order, catalogCustomFields.Order);
        config.customFields.OrderLine = mergeCustomFields(config.customFields.OrderLine, catalogCustomFields.OrderLine);
        config.orderOptions.stockAllocationStrategy = new ChannelStockAllocationStrategy();
        // 库存策略矩阵：单一全局入口（就近/优先级/库存优先/会员专属），余量天然拆单
        config.catalogOptions.stockLocationStrategy = new MatrixStockLocationStrategy();
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
        private autoSplit: AutoSplitPlanService,
        private manualSplit: ManualSplitAdjustService,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin> {
        LogisticsPlugin.options = options ?? {};
        return LogisticsPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.logisticsService.init(this.injector);
        this.autoSplit.init(this.injector);
        this.manualSplit.init(this.injector);
        Logger.info('LogisticsPlugin initialized', loggerCtx);
    }
}
