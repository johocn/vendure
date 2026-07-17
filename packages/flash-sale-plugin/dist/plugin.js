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
const flash_sale_service_1 = require("./flash-sale.service");
const flash_sale_shop_resolver_1 = require("./flash-sale-shop.resolver");
const order_custom_fields_1 = require("./order-custom-fields");
let FlashSalePlugin = FlashSalePlugin_1 = class FlashSalePlugin {
    constructor(options, flashSaleService, flashSaleJob, eventBus, moduleRef) {
        this.options = options;
        this.flashSaleService = flashSaleService;
        this.flashSaleJob = flashSaleJob;
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
        this.flashSaleJob.initStock(this.injector);
        this.eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe(async (event) => {
            var _a;
            if (event.toState !== 'Cancelled')
                return;
            const order = event.order;
            const activityId = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.flashSaleActivityId;
            if (!activityId)
                return;
            try {
                const { StockReserveService } = require('@vendure/redis-stock-plugin');
                const stockReserveService = this.injector.get(StockReserveService);
                if (stockReserveService === null || stockReserveService === void 0 ? void 0 : stockReserveService.isAvailable) {
                    await stockReserveService.releaseStock(`flash-sale:${activityId}`, 1);
                }
            }
            catch (_b) {
                // RedisStockPlugin not installed
            }
        });
        await this.flashSaleJob.init();
        this.flashSaleJob.scheduleCheck();
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
            flash_sale_job_1.FlashSaleJob,
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
                status: FlashSaleStatus!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            extend type Query {
                activeFlashSaleActivities: [FlashSaleActivity!]!
                flashSaleActivity(id: ID!): FlashSaleActivity
            }
        `,
            resolvers: [flash_sale_shop_resolver_1.FlashSaleShopResolver],
        },
        configuration: (config) => {
            var _a, _b;
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
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.FLASH_SALE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, flash_sale_service_1.FlashSaleService,
        flash_sale_job_1.FlashSaleJob,
        core_2.EventBus,
        core_1.ModuleRef])
], FlashSalePlugin);
//# sourceMappingURL=plugin.js.map