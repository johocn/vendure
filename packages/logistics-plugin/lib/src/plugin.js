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
var LogisticsPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const fulfillment_custom_fields_1 = require("./fulfillment-custom-fields");
const channel_custom_fields_1 = require("./channel-custom-fields");
const channel_stock_allocation_strategy_1 = require("./channel-stock-allocation-strategy");
const catalog_custom_fields_1 = require("./catalog-custom-fields");
const matrix_stock_location_strategy_1 = require("./matrix-stock-location-strategy");
const logistics_track_entity_1 = require("./logistics-track.entity");
const logistics_service_1 = require("./logistics.service");
const logistics_admin_resolver_1 = require("./logistics-admin.resolver");
const auto_split_plan_service_1 = require("./auto-split-plan.service");
const manual_split_adjust_service_1 = require("./manual-split-adjust.service");
const split_admin_resolver_1 = require("./split-admin.resolver");
const order_package_entity_1 = require("./order-package.entity");
const order_package_service_1 = require("./order-package.service");
const order_complete_auto_service_1 = require("./order-complete-auto.service");
const order_completion_process_1 = require("./order-completion.process");
const split_shipping_calculator_1 = require("./split-shipping-calculator");
/** 自动交易完成定时任务 id（幂等检测用） */
const AUTO_COMPLETE_TASK_ID = 'order-complete-auto';
/** 自动交易完成定时任务：每 5 分钟扫描 Delivered 超期订单 → Completed（复用 OrderTimeoutPlugin 补偿扫描模式） */
const autoCompleteTask = new core_2.ScheduledTask({
    id: AUTO_COMPLETE_TASK_ID,
    description: 'Scan Delivered orders past completion deadline and mark Completed',
    schedule: cron => cron.every(5).minutes(),
    async execute({ injector, scheduledContext }) {
        const service = injector.get(order_complete_auto_service_1.OrderCompleteAutoService);
        await service.runAutoCompleteScan(scheduledContext);
    },
});
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const logistics_shop_resolver_1 = require("./logistics-shop.resolver");
const order_package_shop_resolver_1 = require("./order-package-shop.resolver");
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
    type LogisticsTrack implements Node {
        id: ID!
        fulfillmentId: ID!
        trackingNo: String!
        carrierCode: String!
        carrierName: String!
        status: String!
        trackInfo: String
        signedAt: DateTime
        lastSyncedAt: DateTime
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type Carrier {
        code: String!
        name: String!
        shortName: String!
    }

    input BatchFulfillmentItem {
        orderId: ID!
        trackingNo: String!
        carrierCode: String!
        packageId: String
        shippingFee: Int
    }

    type BatchFulfillmentItemResult {
        orderId: ID!
        success: Boolean!
        trackId: ID
        error: String
    }

    type BatchFulfillmentResult {
        items: [BatchFulfillmentItemResult!]!
    }

    extend type Query {
        logisticsTracks(orderId: ID!): [LogisticsTrack!]!
        logisticsTrack(id: ID!): LogisticsTrack
        carriers: [Carrier!]!
        splitPlanPreview(orderId: ID!): OrderSplitPlan!
        orderPackages(orderId: ID!): [OrderPackage!]!
    }

    extend type Mutation {
        batchCreateFulfillment(items: [BatchFulfillmentItem!]!): BatchFulfillmentResult!
        refreshTrack(id: ID!): LogisticsTrack!
        confirmSplitPlan(orderId: ID!, packages: [SplitPackageInput!]!): OrderSplitPlan!
        markPackageDelivered(orderId: ID!, packageId: String!): Boolean!
        completeOrder(orderId: ID!): Boolean!
        runAutoCompleteScan: Int!
    }

    input SplitLineInput { orderLineId: ID!, quantity: Int! }
    input SplitPackageInput { stockLocationId: ID!, lines: [SplitLineInput!]! }
    type SplitLine { orderLineId: ID!, quantity: Int! }
    type SplitPackage { packageId: String!, stockLocationId: ID!, lines: [SplitLine!]!, estimatedShippingFee: Float!, deliveryMode: String! }
    type OrderSplitPlan { orderId: ID!, packages: [SplitPackage!]! }

    type OrderPackage implements Node {
        id: ID!
        code: String!
        orderId: ID!
        stockLocationId: ID!
        lines: [SplitLine!]!
        shippingFee: Int
        deliveryMode: String!
        fulfillmentId: ID
        deliveryOrderId: ID
        status: String!
        shippedAt: DateTime
        deliveredAt: DateTime
        cancelledAt: DateTime
        createdAt: DateTime!
        updatedAt: DateTime!
    }
`;
const shopSchema = () => gql `
    type LogisticsTrackShop {
        id: ID!
        fulfillmentId: ID!
        trackingNo: String!
        carrierCode: String!
        carrierName: String!
        status: String!
        trackInfo: String
        signedAt: DateTime
        lastSyncedAt: DateTime
    }

    extend type Query {
        myOrderTracks(orderId: ID!): [LogisticsTrackShop!]!
    }

    type OrderPackageLineShop {
        orderLineId: ID!
        quantity: Int!
        productName: String!
        sku: String!
    }

    type OrderPackageShop {
        code: String!
        deliveryMode: String!
        status: String!
        shippedAt: DateTime
        deliveredAt: DateTime
        cancelledAt: DateTime
        shippingFee: Int
        lines: [OrderPackageLineShop!]!
        trackingNo: String
        carrierName: String
        courierName: String
        courierPhone: String
        thirdPartyNo: String
        etaMinutes: Int
    }

    extend type Query {
        myOrderPackages(orderId: ID!): [OrderPackageShop!]!
    }

    extend type Mutation {
        confirmOrderReceipt(orderId: ID!): Boolean!
    }
`;
let LogisticsPlugin = LogisticsPlugin_1 = class LogisticsPlugin {
    constructor(options, logisticsService, autoSplit, manualSplit, orderPackageService, orderCompleteAuto, moduleRef) {
        this.options = options;
        this.logisticsService = logisticsService;
        this.autoSplit = autoSplit;
        this.manualSplit = manualSplit;
        this.orderPackageService = orderPackageService;
        this.orderCompleteAuto = orderCompleteAuto;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        LogisticsPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return LogisticsPlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.logisticsService.init(this.injector);
        this.autoSplit.init(this.injector);
        this.manualSplit.init(this.injector);
        this.orderPackageService.init(this.injector);
        this.orderCompleteAuto.init(this.injector);
        // Task4 每包独立计费：库存分配在进入 ArrangingPayment 时才写 stockLocationsJson，
        // 而计费时点（setOrderShippingMethod）早于分配 → 运费先按 0 落库。
        // 在此监听 ArrangingPayment 过渡（onTransitionEnd 已分配库存），按拆分明细重算运费并落库 packageShippingJson。
        this.injector
            .get(core_2.EventBus)
            .ofType(core_2.OrderStateTransitionEvent)
            .subscribe(async (event) => {
            if (event.toState !== 'ArrangingPayment') {
                return;
            }
            await this.recalcSplitShipping(event.ctx, event.order.id);
        });
        core_2.Logger.info('LogisticsPlugin initialized', constants_1.loggerCtx);
    }
    /**
     * 重算拆单订单运费：仅在存在 stockLocationsJson 拆分明细时触发，
     * 使 SplitShippingCalculator 按已落库的每包明细计费并写入 Order.packageShippingJson / shippingWithTax。
     */
    async recalcSplitShipping(ctx, orderId) {
        var _a, _b, _c, _d;
        try {
            const orderService = this.injector.get(core_2.OrderService);
            const order = await orderService.findOne(ctx, orderId);
            if (!order || !((_a = order.shippingLines) === null || _a === void 0 ? void 0 : _a.length)) {
                return;
            }
            const hasSplit = ((_b = order.lines) !== null && _b !== void 0 ? _b : []).some((line) => {
                var _a;
                const raw = (_a = line.customFields) === null || _a === void 0 ? void 0 : _a.stockLocationsJson;
                if (!raw) {
                    return false;
                }
                try {
                    const arr = JSON.parse(String(raw));
                    return Array.isArray(arr) && arr.length > 0;
                }
                catch (_b) {
                    return false;
                }
            });
            if (!hasSplit) {
                return;
            }
            const updated = await orderService.applyPriceAdjustments(ctx, order);
            await this.injector.get(core_2.TransactionalConnection).getRepository(ctx, core_2.Order).save(updated, { reload: false });
            core_2.Logger.info(`拆单运费重算 order#${(_c = order.code) !== null && _c !== void 0 ? _c : orderId} -> shippingWithTax=${updated.shippingWithTax}`, constants_1.loggerCtx);
        }
        catch (e) {
            core_2.Logger.warn(`拆单运费重算失败 order#${orderId}: ${(_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : e}`, constants_1.loggerCtx);
        }
    }
};
exports.LogisticsPlugin = LogisticsPlugin;
LogisticsPlugin.options = {};
exports.LogisticsPlugin = LogisticsPlugin = LogisticsPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [logistics_track_entity_1.LogisticsTrack, order_package_entity_1.OrderPackage],
        providers: [
            { provide: constants_1.LOGISTICS_PLUGIN_OPTIONS, useFactory: () => LogisticsPlugin.options },
            logistics_service_1.LogisticsService,
            auto_split_plan_service_1.AutoSplitPlanService,
            manual_split_adjust_service_1.ManualSplitAdjustService,
            order_package_service_1.OrderPackageService,
            order_complete_auto_service_1.OrderCompleteAutoService,
            // 字符串 token：供 delivery-gateway-plugin 通过注入器 duck-typing 解耦调用（挂钩点3）
            { provide: 'OrderPackageLinker', useExisting: order_package_service_1.OrderPackageService },
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [logistics_admin_resolver_1.LogisticsAdminResolver, split_admin_resolver_1.SplitAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [logistics_shop_resolver_1.LogisticsShopResolver, order_package_shop_resolver_1.OrderPackageShopResolver],
        },
        configuration: (config) => {
            var _a;
            config.customFields.Fulfillment = mergeCustomFields(config.customFields.Fulfillment, fulfillment_custom_fields_1.logisticsFulfillmentCustomFields.Fulfillment);
            config.customFields.Channel = mergeCustomFields(config.customFields.Channel, channel_custom_fields_1.logisticsChannelCustomFields.Channel);
            config.customFields.Product = mergeCustomFields(config.customFields.Product, catalog_custom_fields_1.catalogCustomFields.Product);
            config.customFields.StockLocation = mergeCustomFields(config.customFields.StockLocation, catalog_custom_fields_1.catalogCustomFields.StockLocation);
            config.customFields.Order = mergeCustomFields(config.customFields.Order, catalog_custom_fields_1.catalogCustomFields.Order);
            config.customFields.OrderLine = mergeCustomFields(config.customFields.OrderLine, catalog_custom_fields_1.catalogCustomFields.OrderLine);
            config.orderOptions.stockAllocationStrategy = new channel_stock_allocation_strategy_1.ChannelStockAllocationStrategy();
            // 库存策略矩阵：单一全局入口（就近/优先级/库存优先/会员专属），余量天然拆单
            config.catalogOptions.stockLocationStrategy = new matrix_stock_location_strategy_1.MatrixStockLocationStrategy();
            // 每包裹独立计费：读 stockLocationsJson 逐包计费合计（channel.packageShippingRule）
            config.shippingOptions.shippingCalculators = [
                ...(config.shippingOptions.shippingCalculators || []),
                split_shipping_calculator_1.splitShippingCalculator,
            ];
            // 履约闭环：包裹聚合驱动订单状态机（禁用 checkFulfillmentStates，city 包无 fulfillment 不拦截）
            if (!((_a = config.orderOptions.process) !== null && _a !== void 0 ? _a : []).some(p => p.__logisticsClosure)) {
                config.orderOptions.process = [
                    (0, core_2.configureDefaultOrderProcess)({ checkFulfillmentStates: false }),
                    Object.assign(Object.assign({}, order_completion_process_1.orderCompletionProcess), { __logisticsClosure: true }),
                ];
            }
            // 自动交易完成定时任务（幂等注册，复用 OrderTimeoutPlugin 的补偿扫描模式）
            if (!config.schedulerOptions.tasks.some(t => t.id === AUTO_COMPLETE_TASK_ID)) {
                config.schedulerOptions.tasks.push(autoCompleteTask);
            }
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.LOGISTICS_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, logistics_service_1.LogisticsService,
        auto_split_plan_service_1.AutoSplitPlanService,
        manual_split_adjust_service_1.ManualSplitAdjustService,
        order_package_service_1.OrderPackageService,
        order_complete_auto_service_1.OrderCompleteAutoService,
        core_1.ModuleRef])
], LogisticsPlugin);
//# sourceMappingURL=plugin.js.map