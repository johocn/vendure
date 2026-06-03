import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Logger, PluginCommonModule, VendurePlugin, Injector, OrderStateTransitionEvent, EventBus } from '@vendure/core';

const { gql } = require('graphql-tag');

import { FLASH_SALE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { FlashSaleActivity } from './flash-sale-activity.entity';
import { FlashSaleAdminResolver } from './flash-sale-admin.resolver';
import { flashSaleEligibilityCondition } from './flash-sale-eligibility-checker';
import { FlashSaleJob } from './flash-sale.job';
import { flashSaleDiscountCondition } from './flash-sale-promotion-condition';
import { FlashSaleService } from './flash-sale.service';
import { FlashSaleShopResolver } from './flash-sale-shop.resolver';
import { FlashSalePluginOptions } from './types';
import { flashSaleOrderCustomFields } from './order-custom-fields';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [FlashSaleActivity],
    providers: [
        { provide: FLASH_SALE_PLUGIN_OPTIONS, useFactory: () => FlashSalePlugin.options },
        FlashSaleService,
        FlashSaleJob,
    ],
    adminApiExtensions: {
        schema: () => gql`
            enum FlashSaleStatus { upcoming active ended }

            type FlashSaleActivity implements Node {
                id: ID!
                name: String!
                startAt: DateTime!
                endAt: DateTime!
                flashPrice: Int!
                totalStock: Int!
                soldCount: Int!
                limitPerUser: Int!
                status: FlashSaleStatus!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type FlashSaleActivityList implements PaginatedList {
                items: [FlashSaleActivity!]!
                totalItems: Int!
            }

            input CreateFlashSaleActivityInput {
                name: String!
                startAt: DateTime!
                endAt: DateTime!
                flashPrice: Int!
                totalStock: Int!
                limitPerUser: Int
                productId: ID!
                variantId: ID!
            }

            input UpdateFlashSaleActivityInput {
                id: ID!
                name: String
                startAt: DateTime
                endAt: DateTime
                flashPrice: Int
                totalStock: Int
                limitPerUser: Int
                status: FlashSaleStatus
            }

            input FlashSaleActivityListOptions

            extend type Query {
                flashSaleActivities(options: FlashSaleActivityListOptions): FlashSaleActivityList!
                flashSaleActivity(id: ID!): FlashSaleActivity
            }

            extend type Mutation {
                createFlashSaleActivity(input: CreateFlashSaleActivityInput!): FlashSaleActivity!
                updateFlashSaleActivity(input: UpdateFlashSaleActivityInput!): FlashSaleActivity!
                deleteFlashSaleActivity(id: ID!): Boolean!
            }
        `,
        resolvers: [FlashSaleAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            enum FlashSaleStatus { upcoming active ended }

            type FlashSaleActivity implements Node {
                id: ID!
                name: String!
                startAt: DateTime!
                endAt: DateTime!
                flashPrice: Int!
                totalStock: Int!
                soldCount: Int!
                limitPerUser: Int!
                status: FlashSaleStatus!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            extend type Query {
                activeFlashSaleActivities: [FlashSaleActivity!]!
            }
        `,
        resolvers: [FlashSaleShopResolver],
    },
    configuration: (config) => {
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...flashSaleOrderCustomFields.Order!,
        ];

        config.promotionOptions = config.promotionOptions || {};
        config.promotionOptions.promotionConditions = [
            ...(config.promotionOptions.promotionConditions ?? []),
            flashSaleDiscountCondition,
            flashSaleEligibilityCondition,
        ];

        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class FlashSalePlugin implements OnApplicationBootstrap {
    private static options: FlashSalePluginOptions = {};
    private injector: Injector;

    constructor(
        @Inject(FLASH_SALE_PLUGIN_OPTIONS) private options: FlashSalePluginOptions,
        private flashSaleService: FlashSaleService,
        private flashSaleJob: FlashSaleJob,
        private eventBus: EventBus,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: FlashSalePluginOptions): Type<FlashSalePlugin> {
        FlashSalePlugin.options = options ?? {};
        return FlashSalePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.flashSaleService.init(this.injector);
        this.flashSaleJob.initStock(this.injector);

        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Cancelled') return;
            const order = event.order as any;
            const activityId = order?.customFields?.flashSaleActivityId;
            if (!activityId) return;
            try {
                const { StockReserveService } = require('@vendure/redis-stock-plugin') as any;
                const stockReserveService = this.injector.get(StockReserveService) as any;
                if (stockReserveService?.isAvailable) {
                    await stockReserveService.releaseStock(`flash-sale:${activityId}`, 1);
                }
            } catch {
                // RedisStockPlugin not installed
            }
        });
        await this.flashSaleJob.init();
        this.flashSaleJob.scheduleCheck();
        Logger.info('FlashSalePlugin initialized', loggerCtx);
    }
}
