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
import { CouponMarketingService } from './marketing/coupon.service';
import { FlashSaleMarketingService } from './marketing/flash-sale.service';
import { GroupBuyMarketingService } from './marketing/group-buy.service';
import { MarketingAdminResolver } from './marketing/marketing-admin.resolver';
import { MarketingOverviewService } from './marketing/marketing-overview.service';
import { OperationsAdminResolver } from './operations-admin.resolver';
import { OperationsDashboardService } from './operations-dashboard.service';
import { OperationsShopResolver } from './operations-shop.resolver';
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
        CouponMarketingService,
        MarketingOverviewService,
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

            # ===== Coupon (prefixed types/inputs to avoid clash with CouponPlugin) =====
            type MarketingCoupon {
                id: ID!
                name: String!
                description: String
                couponType: String!
                discountValue: Int!
                minSpend: Int!
                maxDiscount: Int!
                startAt: DateTime!
                endAt: DateTime!
                totalQuantity: Int!
                claimedCount: Int!
                limitPerUser: Int!
                isActive: Boolean!
                applicableProductIds: JSON
                applicableCategoryIds: JSON
                isNewUserOnly: Boolean!
                isGlobal: Boolean!
                enabledInCurrentChannel: Boolean!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type MarketingCouponList {
                items: [MarketingCoupon!]!
                totalItems: Int!
            }

            input MarketingCreateCouponInput {
                name: String!
                description: String
                couponType: String!
                discountValue: Int!
                minSpend: Int
                maxDiscount: Int
                startAt: DateTime!
                endAt: DateTime!
                totalQuantity: Int!
                limitPerUser: Int
                isNewUserOnly: Boolean
                isGlobal: Boolean
                applicableProductIds: JSON
                applicableCategoryIds: JSON
            }

            input MarketingUpdateCouponInput {
                name: String
                description: String
                couponType: String
                discountValue: Int
                minSpend: Int
                maxDiscount: Int
                startAt: DateTime
                endAt: DateTime
                totalQuantity: Int
                limitPerUser: Int
                isNewUserOnly: Boolean
                applicableProductIds: JSON
                applicableCategoryIds: JSON
            }

            # ===== Marketing Queries & Mutations =====
            extend type Query {
                marketingOverview: MarketingOverview!
                marketingFlashSaleActivities(options: JSON): MarketingFlashSaleActivityList!
                marketingFlashSaleActivity(id: ID!): MarketingFlashSaleActivity
                marketingGroupBuyActivities(options: JSON): MarketingGroupBuyActivityList!
                marketingGroupBuyActivity(id: ID!): MarketingGroupBuyActivity
                marketingCoupons(options: JSON): MarketingCouponList!
                marketingCoupon(id: ID!): MarketingCoupon
            }

            extend type Mutation {
                createFlashSale(input: CreateFlashSaleInput!): MarketingFlashSaleActivity!
                updateFlashSale(input: UpdateFlashSaleInput!): MarketingFlashSaleActivity!
                deleteFlashSale(id: ID!): Boolean!

                createGroupBuy(input: CreateGroupBuyInput!): MarketingGroupBuyActivity!
                updateGroupBuy(input: UpdateGroupBuyInput!): MarketingGroupBuyActivity!
                deleteGroupBuy(id: ID!): Boolean!

                marketingCreateCoupon(input: MarketingCreateCouponInput!): MarketingCoupon!
                marketingUpdateCoupon(id: ID!, input: MarketingUpdateCouponInput!): MarketingCoupon!
                marketingDeleteCoupon(id: ID!): Boolean!
                marketingEnableCouponForChannel(id: ID!): MarketingCoupon!
                marketingDisableCouponForChannel(id: ID!): MarketingCoupon!
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
        // Register ScheduledTask for content lifecycle
        if (!config.schedulerOptions) {
            config.schedulerOptions = { tasks: [] } as any;
        }
        if (!config.schedulerOptions.tasks) {
            config.schedulerOptions.tasks = [];
        }
        const exists = config.schedulerOptions.tasks.some(t => t.id === contentLifecycleTask.id);
        if (!exists) {
            config.schedulerOptions.tasks.push(contentLifecycleTask);
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
