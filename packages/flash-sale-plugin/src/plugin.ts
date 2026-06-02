import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

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

            type FlashSaleActivity {
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

            extend type Query {
                flashSaleActivities(options: Json): FlashSaleActivityList!
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
            extend type Query {
                activeFlashSaleActivities: [FlashSaleActivity!]!
                flashSaleActivity(id: ID!): FlashSaleActivity
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
    compatibility: '^3.0.0',
})
export class FlashSalePlugin implements OnApplicationBootstrap {
    private static options: FlashSalePluginOptions = {};

    constructor(
        @Inject(FLASH_SALE_PLUGIN_OPTIONS) private options: FlashSalePluginOptions,
        private flashSaleJob: FlashSaleJob,
    ) {}

    static init(options?: FlashSalePluginOptions): Type<FlashSalePlugin> {
        FlashSalePlugin.options = options ?? {};
        return FlashSalePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.flashSaleJob.init();
        this.flashSaleJob.scheduleCheck();
        Logger.info('FlashSalePlugin initialized', loggerCtx);
    }
}
