// e:\code\vendure\packages\operations-plugin\src\operations.plugin.ts
import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, ScheduledTask, VendurePlugin } from '@vendure/core';
import { CouponPlugin } from '@vendure/coupon-plugin';
import { FlashSalePlugin } from '@vendure/flash-sale-plugin';
import { GroupBuyPlugin } from '@vendure/group-buy-plugin';

import { contentLifecycleTask } from './content-lifecycle.task';
import { ContentService } from './content.service';
import { loggerCtx } from './constants';
import { ContentItem } from './entities/content-item.entity';
import { FlashSaleMarketingService } from './marketing/flash-sale.service';
import { GroupBuyMarketingService } from './marketing/group-buy.service';
import { MarketingAdminResolver } from './marketing/marketing-admin.resolver';
import { MarketingOverviewService } from './marketing/marketing-overview.service';
import { OperationsAdminResolver } from './operations-admin.resolver';
import { OperationsDashboardService } from './operations-dashboard.service';
import { OperationsShopResolver } from './operations-shop.resolver';
import { ProductStatsService } from './product-stats.service';
import { ProductStatsSubscriber } from './product-stats.subscriber';
import { productStatsTask } from './product-stats.task';
import { RoleSyncService } from './role-sync';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule, FlashSalePlugin, GroupBuyPlugin, CouponPlugin],
    entities: [ContentItem],
    providers: [
        OperationsDashboardService,
        ContentService,
        FlashSaleMarketingService,
        GroupBuyMarketingService,
        MarketingOverviewService,
        ProductStatsService,
        ProductStatsSubscriber,
    ],
    adminApiExtensions: {
        schema: () => gql`
            # ===== Dashboard =====
            type DashboardMetrics {
                sales: SalesMetrics
                delivery: DeliveryMetrics
                customer: CustomerMetrics
                inventory: InventoryMetrics
                afterSales: AfterSalesMetrics
                marketing: MarketingMetrics
            }

            type SalesMetrics {
                orderCount: Int!
                gmv: Int!
                previousOrderCount: Int!
                previousGmv: Int!
                pendingCount: Int!
            }

            type DeliveryMetrics {
                pending: Int!
                inProgress: Int!
                delivered: Int!
                exception: Int!
            }

            type CustomerMetrics {
                newCount: Int!
                totalCount: Int!
                levelDistribution: [MemberLevelCount!]!
            }

            type MemberLevelCount {
                levelId: ID
                levelName: String
                count: Int!
            }

            type InventoryMetrics {
                lowStockCount: Int!
                pendingStockIn: Int!
                pendingStockOut: Int!
                pendingStockMove: Int!
                pendingStocktake: Int!
            }

            type AfterSalesMetrics {
                pendingCount: Int!
                exceptionOrderCount: Int!
            }

            type MarketingMetrics {
                activeFlashSaleCount: Int!
                activeGroupBuyCount: Int!
                couponClaimedCount: Int!
            }

            type SalesTrendPoint {
                date: String!
                orderCount: Int!
                gmv: Int!
            }

            type CategoryTopItem {
                categoryId: ID!
                categoryName: String!
                gmv: Int!
                orderCount: Int!
            }

            extend type Query {
                dashboardOverview(range: String!): DashboardMetrics!
                salesTrend(days: Int!): [SalesTrendPoint!]!
                categoryTop(days: Int!): [CategoryTopItem!]!
            }

            # ===== CMS =====
            type ContentItem {
                id: ID!
                type: String!
                code: String!
                name: String!
                enabled: Boolean!
                sort: Int!
                position: String!
                startAt: DateTime
                endAt: DateTime
                data: JSON
                staffId: String
                publishedAt: DateTime
                unpublishedAt: DateTime
                deletedAt: DateTime
                deletedBy: String
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type ContentItemList {
                items: [ContentItem!]!
                totalItems: Int!
            }

            input CreateContentItemInput {
                type: String!
                code: String!
                name: String!
                position: String
                sort: Int
                startAt: DateTime
                endAt: DateTime
                data: JSON
            }

            input UpdateContentItemInput {
                name: String
                enabled: Boolean
                sort: Int
                position: String
                startAt: DateTime
                endAt: DateTime
                data: JSON
            }

            type ContentLifecycleResult {
                published: Int!
                unpublished: Int!
            }

            extend type Query {
                contentItems(type: String, position: String, enabled: Boolean, page: Int, pageSize: Int): ContentItemList!
                contentItem(id: ID!): ContentItem
            }

            extend type Mutation {
                createContentItem(input: CreateContentItemInput!): ContentItem!
                updateContentItem(id: ID!, input: UpdateContentItemInput!): ContentItem!
                deleteContentItem(id: ID!): Boolean!
                triggerContentLifecycle: ContentLifecycleResult!

                # 商品展示值（销量/可得积分）重算；省略 productIds = 全量重算。返回实际被更新的商品数。
                recomputeProductStats(productIds: [ID!]): Int!
            }

            # ===== Marketing Overview =====
            type MarketingCategoryCount {
                active: Int!
                upcoming: Int!
                ended: Int!
            }

            type MarketingOverview {
                flashSale: MarketingCategoryCount!
                groupBuy: MarketingCategoryCount!
                coupon: MarketingCategoryCount!
            }

            # ===== FlashSale (prefixed types to avoid clash with FlashSalePlugin) =====
            type MarketingFlashSaleActivity {
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
                status: String!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type MarketingFlashSaleActivityList {
                items: [MarketingFlashSaleActivity!]!
                totalItems: Int!
            }

            input CreateFlashSaleInput {
                name: String!
                startAt: DateTime!
                endAt: DateTime!
                flashPrice: Int!
                totalStock: Int!
                limitPerUser: Int
                productId: ID!
                variantId: ID!
            }

            input UpdateFlashSaleInput {
                id: ID!
                name: String
                startAt: DateTime
                endAt: DateTime
                flashPrice: Int
                totalStock: Int
                limitPerUser: Int
                productId: ID
                variantId: ID
            }

            # ===== GroupBuy (prefixed types to avoid clash with GroupBuyPlugin) =====
            type MarketingGroupBuyActivity {
                id: ID!
                name: String!
                description: String!
                targetCount: Int!
                currentCount: Int!
                maxCount: Int!
                status: String!
                startAt: DateTime!
                endAt: DateTime!
                groupPrice: Int!
                leaderDiscount: Int!
                leaderRewardType: String!
                rewardRules: JSON
                autoConfirm: Boolean!
                productId: ID!
                variantId: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type MarketingGroupBuyActivityList {
                items: [MarketingGroupBuyActivity!]!
                totalItems: Int!
            }

            input CreateGroupBuyInput {
                name: String!
                description: String!
                targetCount: Int!
                maxCount: Int
                startAt: DateTime!
                endAt: DateTime!
                groupPrice: Int!
                leaderDiscount: Int
                leaderRewardType: String
                autoConfirm: Boolean
                productId: ID!
                variantId: ID!
                rewardRules: JSON
            }

            input UpdateGroupBuyInput {
                id: ID!
                name: String
                description: String
                targetCount: Int
                maxCount: Int
                startAt: DateTime
                endAt: DateTime
                groupPrice: Int
                leaderDiscount: Int
                leaderRewardType: String
                autoConfirm: Boolean
                status: String
                rewardRules: JSON
            }

            # ===== Marketing Queries & Mutations =====
            extend type Query {
                marketingOverview: MarketingOverview!
                marketingFlashSaleActivities(options: JSON): MarketingFlashSaleActivityList!
                marketingFlashSaleActivity(id: ID!): MarketingFlashSaleActivity
                marketingGroupBuyActivities(options: JSON): MarketingGroupBuyActivityList!
                marketingGroupBuyActivity(id: ID!): MarketingGroupBuyActivity
            }

            extend type Mutation {
                createFlashSale(input: CreateFlashSaleInput!): MarketingFlashSaleActivity!
                updateFlashSale(input: UpdateFlashSaleInput!): MarketingFlashSaleActivity!
                deleteFlashSale(id: ID!): Boolean!

                createGroupBuy(input: CreateGroupBuyInput!): MarketingGroupBuyActivity!
                updateGroupBuy(input: UpdateGroupBuyInput!): MarketingGroupBuyActivity!
                deleteGroupBuy(id: ID!): Boolean!
            }
        `,
        resolvers: [OperationsAdminResolver, MarketingAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            type ContentItemPublic {
                id: ID!
                type: String!
                code: String!
                name: String!
                sort: Int!
                position: String!
                data: JSON
                startAt: DateTime
                endAt: DateTime
            }

            extend type Query {
                publishedContent(type: String, position: String): [ContentItemPublic!]!
            }
        `,
        resolvers: [OperationsShopResolver],
    },
    configuration: (config) => {
        // 注册 ScheduledTask：内容自动上下线 + 商品展示值每日重算
        if (!config.schedulerOptions) {
            config.schedulerOptions = { tasks: [] } as any;
        }
        if (!config.schedulerOptions.tasks) {
            config.schedulerOptions.tasks = [];
        }
        for (const task of [contentLifecycleTask, productStatsTask]) {
            if (!config.schedulerOptions.tasks.some(t => t.id === task.id)) {
                config.schedulerOptions.tasks.push(task);
            }
        }

        // 合并自定义字段：Product.displayTemplate 与 Channel.themeId
        config.customFields = config.customFields ?? {};
        config.customFields.Product = config.customFields.Product ?? [];
        if (!config.customFields.Product.some(cf => cf.name === 'displayTemplate')) {
            config.customFields.Product.push({
                name: 'displayTemplate',
                type: 'localeString',
                defaultValue: 'standard',
                list: false,
                public: true,
                ui: {
                    component: 'select-form-input',
                    options: [
                        { value: 'standard', label: 'Standard' },
                        { value: 'galleryFirst', label: 'Gallery First' },
                        { value: 'rich', label: 'Rich' },
                    ],
                },
            });
        }
        config.customFields.Channel = config.customFields.Channel ?? [];
        if (!config.customFields.Channel.some(cf => cf.name === 'themeId')) {
            config.customFields.Channel.push({
                name: 'themeId',
                type: 'string',
                defaultValue: 'taobao-orange',
                list: false,
                public: true,
                ui: {
                    component: 'select-form-input',
                    options: [
                        { value: 'jd-red', label: '京东红' },
                        { value: 'taobao-orange', label: '淘宝橙' },
                        { value: 'modern-minimal', label: '现代极简' },
                        { value: 'brand', label: '品牌定制' },
                        { value: 'default', label: '默认' },
                    ],
                },
            });
        }
        return config;
    },
    compatibility: '^3.6.0',
})
export class OperationsPlugin implements OnApplicationBootstrap {
    constructor(private moduleRef?: ModuleRef) {}

    static init = (): typeof OperationsPlugin => OperationsPlugin;

    async onApplicationBootstrap(): Promise<void> {
        Logger.info('onApplicationBootstrap called', loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new Injector(this.moduleRef);
            const roleSync = new RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        } catch (err: any) {
            Logger.error(`Bootstrap failed: ${err?.message ?? err}`, loggerCtx);
        }
    }
}
