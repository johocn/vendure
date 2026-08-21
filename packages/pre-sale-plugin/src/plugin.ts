import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    Injector,
    Logger,
    OrderStateTransitionEvent,
    PluginCommonModule,
    VendurePlugin,
    EventBus,
} from '@vendure/core';
import gql from 'graphql-tag';

import { PRE_SALE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { PreSaleActivity } from './pre-sale-activity.entity';
import { PreSaleAdminResolver } from './pre-sale-admin.resolver';
import { preSaleStatusTask } from './pre-sale.job';
import { preSaleDiscountCondition } from './pre-sale-promotion-condition';
import { preSalePriceAction } from './pre-sale-price-action';
import { preSaleOrderProcess } from './pre-sale.order-process';
import { PreSaleOrderPlacedStrategy } from './pre-sale-order-placed-strategy';
import { PreSaleService } from './pre-sale.service';
import { PreSaleShopResolver } from './pre-sale-shop.resolver';
import { PreSalePluginOptions } from './types';
import { preSaleOrderCustomFields } from './order-custom-fields';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [PreSaleActivity],
    providers: [
        { provide: PRE_SALE_PLUGIN_OPTIONS, useFactory: () => PreSalePlugin.options },
        PreSaleService,
    ],
    exports: [PreSaleService],
    adminApiExtensions: {
        schema: () => gql`
            enum PreSaleMode { deposit full }
            enum PreSaleStatus { upcoming active delivered ended }

            type PreSaleActivity implements Node {
                id: ID!
                name: String!
                mode: PreSaleMode!
                startAt: DateTime!
                endAt: DateTime!
                releaseAt: DateTime
                tailStartAt: DateTime
                tailEndAt: DateTime
                presalePrice: Int!
                depositAmount: Int!
                totalStock: Int!
                soldCount: Int!
                limitPerUser: Int!
                productId: ID!
                variantId: ID!
                status: PreSaleStatus!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type PreSaleActivityList implements PaginatedList {
                items: [PreSaleActivity!]!
                totalItems: Int!
            }

            input CreatePreSaleActivityInput {
                name: String!
                mode: PreSaleMode!
                startAt: DateTime!
                endAt: DateTime!
                releaseAt: DateTime
                tailStartAt: DateTime
                tailEndAt: DateTime
                presalePrice: Int!
                depositAmount: Int!
                totalStock: Int!
                limitPerUser: Int
                productId: ID!
                variantId: ID!
            }

            input UpdatePreSaleActivityInput {
                id: ID!
                name: String
                mode: PreSaleMode
                startAt: DateTime
                endAt: DateTime
                releaseAt: DateTime
                tailStartAt: DateTime
                tailEndAt: DateTime
                presalePrice: Int
                depositAmount: Int
                totalStock: Int
                limitPerUser: Int
                productId: ID
                variantId: ID
            }

            input PreSaleActivityListOptions

            extend type Query {
                preSaleActivities(options: PreSaleActivityListOptions): PreSaleActivityList!
                preSaleActivity(id: ID!): PreSaleActivity
            }

            extend type Mutation {
                createPreSaleActivity(input: CreatePreSaleActivityInput!): PreSaleActivity!
                updatePreSaleActivity(input: UpdatePreSaleActivityInput!): PreSaleActivity!
                deletePreSaleActivity(id: ID!): Boolean!
                deliverPreSale(id: ID!): PreSaleActivity!
            }
        `,
        resolvers: [PreSaleAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            enum PreSaleMode { deposit full }
            enum PreSaleStatus { upcoming active delivered ended }

            type PreSaleActivity implements Node {
                id: ID!
                name: String!
                mode: PreSaleMode!
                startAt: DateTime!
                endAt: DateTime!
                releaseAt: DateTime
                tailStartAt: DateTime
                tailEndAt: DateTime
                presalePrice: Int!
                depositAmount: Int!
                totalStock: Int!
                soldCount: Int!
                limitPerUser: Int!
                productId: ID!
                variantId: ID!
                status: PreSaleStatus!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            extend type Query {
                activePreSaleActivities: [PreSaleActivity!]!
            }

            extend type Mutation {
                applyPreSale(activityId: ID!): Order!
                payPreSaleFull(orderId: ID!, method: String!): Order!
                payPreSaleDeposit(orderId: ID!, method: String!): Order!
                payPreSaleTail(orderId: ID!, method: String!): Order!
            }
        `,
        resolvers: [PreSaleShopResolver],
    },
    configuration: (config) => {
        config.customFields.Order = mergeCustomFields(config.customFields.Order, preSaleOrderCustomFields.Order);

        config.promotionOptions = config.promotionOptions || {};
        config.promotionOptions.promotionConditions = [
            ...(config.promotionOptions.promotionConditions ?? []),
            preSaleDiscountCondition,
        ];
        config.promotionOptions.promotionActions = [
            ...(config.promotionOptions.promotionActions ?? []),
            preSalePriceAction,
        ];

        // 定金两阶段：ArrangingPayment → Deposited（已付定金）即视为订单已下单
        config.orderOptions.orderPlacedStrategy = new PreSaleOrderPlacedStrategy();

        // 注册预售两阶段支付自定义订单状态机（幂等：已由本插件注册过则跳过）
        const orderProcesses = config.orderOptions?.process ?? [];
        const hasPreSaleProcess = orderProcesses.some(
            (p: any) => (p as any)?.transitions && (p as any).__preSaleRegistered,
        );
        if (!hasPreSaleProcess) {
            (preSaleOrderProcess as any).__preSaleRegistered = true;
            config.orderOptions.process = [...orderProcesses, preSaleOrderProcess];
        }

        // 注册预售状态转换 ScheduledTask（由 DefaultSchedulerPlugin 在 worker 上周期执行）
        if (!config.schedulerOptions) {
            config.schedulerOptions = { tasks: [] } as any;
        }
        if (!config.schedulerOptions.tasks) {
            config.schedulerOptions.tasks = [];
        }
        config.schedulerOptions.tasks.push(preSaleStatusTask);

        return config;
    },
    compatibility: '^3.0.0',
})
export class PreSalePlugin implements OnApplicationBootstrap {
    private static options: PreSalePluginOptions = {};
    private injector: Injector;

    constructor(
        @Inject(PRE_SALE_PLUGIN_OPTIONS) private options: PreSalePluginOptions,
        private preSaleService: PreSaleService,
        private eventBus: EventBus,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: PreSalePluginOptions): Type<PreSalePlugin> {
        PreSalePlugin.options = options ?? {};
        return PreSalePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.preSaleService.init(this.injector);

        // 订单取消时按订单内预售行实际件数回滚锁定库存
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Cancelled') return;
            const activityId = (event.order as any)?.customFields?.preSaleActivityId;
            if (!activityId) return;
            try {
                await this.preSaleService.releaseStockForOrder(event.ctx, event.order.id);
            } catch (e: any) {
                Logger.error(
                    `Failed to release stock for activity ${activityId} on cancel: ${e.message}`,
                    loggerCtx,
                );
            }
        });

        Logger.info('PreSalePlugin initialized', loggerCtx);
    }
}