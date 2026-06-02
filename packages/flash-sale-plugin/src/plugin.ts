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

const adminSchema = gql`
    type FlashSaleActivity {
        id: ID!
        name: String!
        startAt: DateTime!
        endAt: DateTime!
        flashPrice: Int!
        totalStock: Int!
        soldCount: Int!
        limitPerUser: Int!
        productId: Int!
        variantId: Int!
        status: String!
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
        productId: Int!
        variantId: Int!
    }

    input UpdateFlashSaleActivityInput {
        id: ID!
        name: String
        startAt: DateTime
        endAt: DateTime
        flashPrice: Int
        totalStock: Int
        limitPerUser: Int
        productId: Int
        variantId: Int
        status: String
    }

    extend type Query {
        flashSaleActivities(options: ListQueryOptions): FlashSaleActivityList!
        flashSaleActivity(id: ID!): FlashSaleActivity
    }

    extend type Mutation {
        createFlashSaleActivity(input: CreateFlashSaleActivityInput!): FlashSaleActivity!
        updateFlashSaleActivity(input: UpdateFlashSaleActivityInput!): FlashSaleActivity!
        deleteFlashSaleActivity(id: ID!): Boolean!
    }
`;

const shopSchema = gql`
    type FlashSaleActivity {
        id: ID!
        name: String!
        startAt: DateTime!
        endAt: DateTime!
        flashPrice: Int!
        totalStock: Int!
        soldCount: Int!
        limitPerUser: Int!
        productId: Int!
        variantId: Int!
        status: String!
    }

    type FlashSaleActivityList implements PaginatedList {
        items: [FlashSaleActivity!]!
        totalItems: Int!
    }

    extend type Query {
        activeFlashSaleActivities(options: ListQueryOptions): FlashSaleActivityList!
        flashSaleActivity(id: ID!): FlashSaleActivity
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [FlashSaleActivity],
    providers: [
        { provide: FLASH_SALE_PLUGIN_OPTIONS, useFactory: () => FlashSalePlugin.options },
        FlashSaleService,
        FlashSaleJob,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [FlashSaleAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
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
