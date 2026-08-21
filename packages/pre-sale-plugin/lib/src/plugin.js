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
var PreSalePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreSalePlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const pre_sale_activity_entity_1 = require("./pre-sale-activity.entity");
const pre_sale_admin_resolver_1 = require("./pre-sale-admin.resolver");
const pre_sale_job_1 = require("./pre-sale.job");
const pre_sale_promotion_condition_1 = require("./pre-sale-promotion-condition");
const pre_sale_price_action_1 = require("./pre-sale-price-action");
const pre_sale_order_process_1 = require("./pre-sale.order-process");
const pre_sale_order_placed_strategy_1 = require("./pre-sale-order-placed-strategy");
const pre_sale_service_1 = require("./pre-sale.service");
const pre_sale_shop_resolver_1 = require("./pre-sale-shop.resolver");
const order_custom_fields_1 = require("./order-custom-fields");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
let PreSalePlugin = PreSalePlugin_1 = class PreSalePlugin {
    constructor(options, preSaleService, eventBus, moduleRef) {
        this.options = options;
        this.preSaleService = preSaleService;
        this.eventBus = eventBus;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        PreSalePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return PreSalePlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.preSaleService.init(this.injector);
        // 订单取消时按订单内预售行实际件数回滚锁定库存
        this.eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe(async (event) => {
            var _a, _b;
            if (event.toState !== 'Cancelled')
                return;
            const activityId = (_b = (_a = event.order) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.preSaleActivityId;
            if (!activityId)
                return;
            try {
                await this.preSaleService.releaseStockForOrder(event.ctx, event.order.id);
            }
            catch (e) {
                core_2.Logger.error(`Failed to release stock for activity ${activityId} on cancel: ${e.message}`, constants_1.loggerCtx);
            }
        });
        core_2.Logger.info('PreSalePlugin initialized', constants_1.loggerCtx);
    }
};
exports.PreSalePlugin = PreSalePlugin;
PreSalePlugin.options = {};
exports.PreSalePlugin = PreSalePlugin = PreSalePlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [pre_sale_activity_entity_1.PreSaleActivity],
        providers: [
            { provide: constants_1.PRE_SALE_PLUGIN_OPTIONS, useFactory: () => PreSalePlugin.options },
            pre_sale_service_1.PreSaleService,
        ],
        exports: [pre_sale_service_1.PreSaleService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
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
            resolvers: [pre_sale_admin_resolver_1.PreSaleAdminResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
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
            resolvers: [pre_sale_shop_resolver_1.PreSaleShopResolver],
        },
        configuration: (config) => {
            var _a, _b, _c, _d;
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.preSaleOrderCustomFields.Order);
            config.promotionOptions = config.promotionOptions || {};
            config.promotionOptions.promotionConditions = [
                ...((_a = config.promotionOptions.promotionConditions) !== null && _a !== void 0 ? _a : []),
                pre_sale_promotion_condition_1.preSaleDiscountCondition,
            ];
            config.promotionOptions.promotionActions = [
                ...((_b = config.promotionOptions.promotionActions) !== null && _b !== void 0 ? _b : []),
                pre_sale_price_action_1.preSalePriceAction,
            ];
            // 定金两阶段：ArrangingPayment → Deposited（已付定金）即视为订单已下单
            config.orderOptions.orderPlacedStrategy = new pre_sale_order_placed_strategy_1.PreSaleOrderPlacedStrategy();
            // 注册预售两阶段支付自定义订单状态机（幂等：已由本插件注册过则跳过）
            const orderProcesses = (_d = (_c = config.orderOptions) === null || _c === void 0 ? void 0 : _c.process) !== null && _d !== void 0 ? _d : [];
            const hasPreSaleProcess = orderProcesses.some((p) => (p === null || p === void 0 ? void 0 : p.transitions) && p.__preSaleRegistered);
            if (!hasPreSaleProcess) {
                pre_sale_order_process_1.preSaleOrderProcess.__preSaleRegistered = true;
                config.orderOptions.process = [...orderProcesses, pre_sale_order_process_1.preSaleOrderProcess];
            }
            // 注册预售状态转换 ScheduledTask（由 DefaultSchedulerPlugin 在 worker 上周期执行）
            if (!config.schedulerOptions) {
                config.schedulerOptions = { tasks: [] };
            }
            if (!config.schedulerOptions.tasks) {
                config.schedulerOptions.tasks = [];
            }
            config.schedulerOptions.tasks.push(pre_sale_job_1.preSaleStatusTask);
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.PRE_SALE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, pre_sale_service_1.PreSaleService,
        core_2.EventBus,
        core_1.ModuleRef])
], PreSalePlugin);
//# sourceMappingURL=plugin.js.map