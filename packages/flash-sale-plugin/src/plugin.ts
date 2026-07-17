import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    Injector,
    Logger,
    OrderPlacedEvent,
    OrderStateTransitionEvent,
    PluginCommonModule,
    VendurePlugin,
    EventBus,
} from '@vendure/core';
import gql from 'graphql-tag';

import { FLASH_SALE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { FlashSaleActivity } from './flash-sale-activity.entity';
import { FlashSaleAdminResolver } from './flash-sale-admin.resolver';
import { flashSaleEligibilityCondition } from './flash-sale-eligibility-checker';
import { flashSaleStatusTask } from './flash-sale.job';
import { flashSaleDiscountCondition } from './flash-sale-promotion-condition';
import { flashSalePriceAction } from './flash-sale-price-action';
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
                productId: ID!
                variantId: ID!
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
                productId: ID
                variantId: ID
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
                productId: ID!
                variantId: ID!
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
        config.promotionOptions.promotionActions = [
            ...(config.promotionOptions.promotionActions ?? []),
            flashSalePriceAction,
        ];

        // 注册秒杀状态转换 ScheduledTask（由 DefaultSchedulerPlugin 在 worker 上周期执行）
        if (!config.schedulerOptions) {
            config.schedulerOptions = { tasks: [] } as any;
        }
        if (!config.schedulerOptions.tasks) {
            config.schedulerOptions.tasks = [];
        }
        config.schedulerOptions.tasks.push(flashSaleStatusTask);

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

        // 秒杀订单下单后递增 soldCount（含 customFields.flashSaleActivityId 的订单）
        this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
            const flashSaleActivityId = (event.order as any).customFields?.flashSaleActivityId;
            if (!flashSaleActivityId) return;
            try {
                await this.flashSaleService.incrementSoldCount(
                    event.ctx,
                    flashSaleActivityId,
                    event.order.totalQuantity,
                );
            } catch (e: any) {
                Logger.error(
                    `Failed to increment soldCount for activity ${flashSaleActivityId}: ${e.message}`,
                    loggerCtx,
                );
            }
        });

        // 订单取消时回滚预占库存（Redis / DB 路径均覆盖）
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Cancelled') return;
            const activityId = (event.order as any)?.customFields?.flashSaleActivityId;
            if (!activityId) return;
            try {
                await this.flashSaleService.releaseStock(event.ctx, activityId, 1);
            } catch (e: any) {
                Logger.error(
                    `Failed to release stock for activity ${activityId} on cancel: ${e.message}`,
                    loggerCtx,
                );
            }
        });

        Logger.info('FlashSalePlugin initialized', loggerCtx);
    }
}
