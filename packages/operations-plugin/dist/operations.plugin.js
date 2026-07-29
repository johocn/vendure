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
var OperationsPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationsPlugin = void 0;
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const content_lifecycle_task_1 = require("./content-lifecycle.task");
const content_service_1 = require("./content.service");
const constants_1 = require("./constants");
const content_item_entity_1 = require("./entities/content-item.entity");
const coupon_service_1 = require("./marketing/coupon.service");
const flash_sale_service_1 = require("./marketing/flash-sale.service");
const group_buy_service_1 = require("./marketing/group-buy.service");
const marketing_admin_resolver_1 = require("./marketing/marketing-admin.resolver");
const marketing_overview_service_1 = require("./marketing/marketing-overview.service");
const operations_admin_resolver_1 = require("./operations-admin.resolver");
const operations_dashboard_service_1 = require("./operations-dashboard.service");
const operations_shop_resolver_1 = require("./operations-shop.resolver");
const role_sync_1 = require("./role-sync");
const { gql } = require('graphql-tag');
let OperationsPlugin = OperationsPlugin_1 = class OperationsPlugin {
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
    }
    async onApplicationBootstrap() {
        var _a;
        core_2.Logger.info('onApplicationBootstrap called', constants_1.loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new core_2.Injector(this.moduleRef);
            const roleSync = new role_sync_1.RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        }
        catch (err) {
            core_2.Logger.error(`Bootstrap failed: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, constants_1.loggerCtx);
        }
    }
};
exports.OperationsPlugin = OperationsPlugin;
OperationsPlugin.init = () => OperationsPlugin_1;
exports.OperationsPlugin = OperationsPlugin = OperationsPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [content_item_entity_1.ContentItem],
        providers: [
            operations_dashboard_service_1.OperationsDashboardService,
            content_service_1.ContentService,
            flash_sale_service_1.FlashSaleMarketingService,
            group_buy_service_1.GroupBuyMarketingService,
            coupon_service_1.CouponMarketingService,
            marketing_overview_service_1.MarketingOverviewService,
        ],
        adminApiExtensions: {
            schema: () => gql `
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
            resolvers: [operations_admin_resolver_1.OperationsAdminResolver, marketing_admin_resolver_1.MarketingAdminResolver],
        },
        shopApiExtensions: {
            schema: () => gql `
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
            resolvers: [operations_shop_resolver_1.OperationsShopResolver],
        },
        configuration: (config) => {
            // Register ScheduledTask for content lifecycle
            if (!config.schedulerOptions) {
                config.schedulerOptions = { tasks: [] };
            }
            if (!config.schedulerOptions.tasks) {
                config.schedulerOptions.tasks = [];
            }
            const exists = config.schedulerOptions.tasks.some(t => t.id === content_lifecycle_task_1.contentLifecycleTask.id);
            if (!exists) {
                config.schedulerOptions.tasks.push(content_lifecycle_task_1.contentLifecycleTask);
            }
            return config;
        },
        compatibility: '^3.6.0',
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], OperationsPlugin);
