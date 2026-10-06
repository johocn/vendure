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
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const flash_sale_plugin_1 = require("@vendure/flash-sale-plugin");
const group_buy_plugin_1 = require("@vendure/group-buy-plugin");
const content_lifecycle_task_1 = require("./content-lifecycle.task");
const content_service_1 = require("./content.service");
const constants_1 = require("./constants");
const content_item_entity_1 = require("./entities/content-item.entity");
const flash_sale_service_1 = require("./marketing/flash-sale.service");
const group_buy_service_1 = require("./marketing/group-buy.service");
const marketing_admin_resolver_1 = require("./marketing/marketing-admin.resolver");
const marketing_overview_service_1 = require("./marketing/marketing-overview.service");
const operations_admin_resolver_1 = require("./operations-admin.resolver");
const operations_dashboard_service_1 = require("./operations-dashboard.service");
const operations_shop_resolver_1 = require("./operations-shop.resolver");
const product_stats_service_1 = require("./product-stats.service");
const product_stats_subscriber_1 = require("./product-stats.subscriber");
const product_stats_task_1 = require("./product-stats.task");
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
        imports: [core_2.PluginCommonModule, flash_sale_plugin_1.FlashSalePlugin, group_buy_plugin_1.GroupBuyPlugin, coupon_plugin_1.CouponPlugin],
        entities: [content_item_entity_1.ContentItem],
        providers: [
            operations_dashboard_service_1.OperationsDashboardService,
            content_service_1.ContentService,
            flash_sale_service_1.FlashSaleMarketingService,
            group_buy_service_1.GroupBuyMarketingService,
            marketing_overview_service_1.MarketingOverviewService,
            product_stats_service_1.ProductStatsService,
            product_stats_subscriber_1.ProductStatsSubscriber,
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

            type ReviewOverview {
                totalApproved: Int!
                avgRating: Float!
                badRate: Float!
                pendingCount: Int!
                withImagesRate: Float!
            }

            type ProductSalesItem {
                productId: ID!
                name: String!
                quantity: Int!
                amount: Int!
            }

            type RiderEfficiencyItem {
                customerId: ID!
                name: String!
                completed: Int!
                onTimeRate: Float!
            }

            extend type Query {
                dashboardOverview(range: String!): DashboardMetrics!
                salesTrend(days: Int!): [SalesTrendPoint!]!
                categoryTop(days: Int!): [CategoryTopItem!]!
                repurchaseRate(days: Int!): Float!
                reviewOverview: ReviewOverview!
                productSalesTop(days: Int!, take: Int): [ProductSalesItem!]!
                riderEfficiency(days: Int!, take: Int): [RiderEfficiencyItem!]!
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
            var _a, _b, _c;
            // 注册 ScheduledTask：内容自动上下线 + 商品展示值每日重算
            if (!config.schedulerOptions) {
                config.schedulerOptions = { tasks: [] };
            }
            if (!config.schedulerOptions.tasks) {
                config.schedulerOptions.tasks = [];
            }
            for (const task of [content_lifecycle_task_1.contentLifecycleTask, product_stats_task_1.productStatsTask]) {
                if (!config.schedulerOptions.tasks.some(t => t.id === task.id)) {
                    config.schedulerOptions.tasks.push(task);
                }
            }
            // 合并自定义字段：Product.displayTemplate 与 Channel.themeId
            config.customFields = (_a = config.customFields) !== null && _a !== void 0 ? _a : {};
            config.customFields.Product = (_b = config.customFields.Product) !== null && _b !== void 0 ? _b : [];
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
            config.customFields.Channel = (_c = config.customFields.Channel) !== null && _c !== void 0 ? _c : [];
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
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], OperationsPlugin);
