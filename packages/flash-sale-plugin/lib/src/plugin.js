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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var FlashSalePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlashSalePlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const flash_sale_activity_entity_1 = require("./flash-sale-activity.entity");
const flash_sale_admin_resolver_1 = require("./flash-sale-admin.resolver");
const flash_sale_eligibility_checker_1 = require("./flash-sale-eligibility-checker");
const flash_sale_job_1 = require("./flash-sale.job");
const flash_sale_promotion_condition_1 = require("./flash-sale-promotion-condition");
const flash_sale_price_action_1 = require("./flash-sale-price-action");
const flash_sale_service_1 = require("./flash-sale.service");
const flash_sale_shop_resolver_1 = require("./flash-sale-shop.resolver");
const order_custom_fields_1 = require("./order-custom-fields");
let FlashSalePlugin = FlashSalePlugin_1 = class FlashSalePlugin {
    constructor(options, flashSaleService, eventBus, moduleRef) {
        this.options = options;
        this.flashSaleService = flashSaleService;
        this.eventBus = eventBus;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        FlashSalePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return FlashSalePlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.flashSaleService.init(this.injector);
        // 秒杀订单下单后递增 soldCount（含 customFields.flashSaleActivityId 的订单）
        this.eventBus.ofType(core_2.OrderPlacedEvent).subscribe(async (event) => {
            var _a;
            const flashSaleActivityId = (_a = event.order.customFields) === null || _a === void 0 ? void 0 : _a.flashSaleActivityId;
            if (!flashSaleActivityId)
                return;
            try {
                await this.flashSaleService.incrementSoldCount(event.ctx, flashSaleActivityId, event.order.totalQuantity);
            }
            catch (e) {
                core_2.Logger.error(`Failed to increment soldCount for activity ${flashSaleActivityId}: ${e.message}`, constants_1.loggerCtx);
            }
        });
        // 订单取消时回滚预占库存（Redis / DB 路径均覆盖）
        this.eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe(async (event) => {
            var _a, _b;
            if (event.toState !== 'Cancelled')
                return;
            const activityId = (_b = (_a = event.order) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.flashSaleActivityId;
            if (!activityId)
                return;
            try {
                await this.flashSaleService.releaseStock(event.ctx, activityId, 1);
            }
            catch (e) {
                core_2.Logger.error(`Failed to release stock for activity ${activityId} on cancel: ${e.message}`, constants_1.loggerCtx);
            }
        });
        core_2.Logger.info('FlashSalePlugin initialized', constants_1.loggerCtx);
    }
};
exports.FlashSalePlugin = FlashSalePlugin;
FlashSalePlugin.options = {};
exports.FlashSalePlugin = FlashSalePlugin = FlashSalePlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [flash_sale_activity_entity_1.FlashSaleActivity],
        providers: [
            { provide: constants_1.FLASH_SALE_PLUGIN_OPTIONS, useFactory: () => FlashSalePlugin.options },
            flash_sale_service_1.FlashSaleService,
        ],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
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
            resolvers: [flash_sale_admin_resolver_1.FlashSaleAdminResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
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
            resolvers: [flash_sale_shop_resolver_1.FlashSaleShopResolver],
        },
        configuration: (config) => {
            var _a, _b, _c;
            config.customFields.Order = [
                ...((_a = config.customFields.Order) !== null && _a !== void 0 ? _a : []),
                ...order_custom_fields_1.flashSaleOrderCustomFields.Order,
            ];
            config.promotionOptions = config.promotionOptions || {};
            config.promotionOptions.promotionConditions = [
                ...((_b = config.promotionOptions.promotionConditions) !== null && _b !== void 0 ? _b : []),
                flash_sale_promotion_condition_1.flashSaleDiscountCondition,
                flash_sale_eligibility_checker_1.flashSaleEligibilityCondition,
            ];
            config.promotionOptions.promotionActions = [
                ...((_c = config.promotionOptions.promotionActions) !== null && _c !== void 0 ? _c : []),
                flash_sale_price_action_1.flashSalePriceAction,
            ];
            // 注册秒杀状态转换 ScheduledTask（由 DefaultSchedulerPlugin 在 worker 上周期执行）
            if (!config.schedulerOptions) {
                config.schedulerOptions = { tasks: [] };
            }
            if (!config.schedulerOptions.tasks) {
                config.schedulerOptions.tasks = [];
            }
            config.schedulerOptions.tasks.push(flash_sale_job_1.flashSaleStatusTask);
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.FLASH_SALE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, flash_sale_service_1.FlashSaleService,
        core_2.EventBus,
        core_1.ModuleRef])
], FlashSalePlugin);
//# sourceMappingURL=plugin.js.map