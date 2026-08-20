import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    configureDefaultOrderProcess,
    EventBus,
    ID,
    Injector,
    Logger,
    Order,
    OrderLine,
    OrderService,
    OrderStateTransitionEvent,
    PluginCommonModule,
    RequestContext,
    ScheduledTask,
    TransactionalConnection,
    VendurePlugin,
} from '@vendure/core';

import { LOGISTICS_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { LogisticsPluginOptions } from './types';
import { logisticsFulfillmentCustomFields } from './fulfillment-custom-fields';
import { logisticsChannelCustomFields } from './channel-custom-fields';
import { ChannelStockAllocationStrategy } from './channel-stock-allocation-strategy';
import { catalogCustomFields } from './catalog-custom-fields';
import { MatrixStockLocationStrategy } from './matrix-stock-location-strategy';
import { LogisticsTrack } from './logistics-track.entity';
import { LogisticsService } from './logistics.service';
import { LogisticsAdminResolver } from './logistics-admin.resolver';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { SplitAdminResolver } from './split-admin.resolver';
import { OrderPackage } from './order-package.entity';
import { OrderPackageService } from './order-package.service';
import { OrderCompleteAutoService } from './order-complete-auto.service';
import { orderCompletionProcess } from './order-completion.process';
import { splitShippingCalculator } from './split-shipping-calculator';

/** 自动交易完成定时任务 id（幂等检测用） */
const AUTO_COMPLETE_TASK_ID = 'order-complete-auto';

/** 自动交易完成定时任务：每 5 分钟扫描 Delivered 超期订单 → Completed（复用 OrderTimeoutPlugin 补偿扫描模式） */
const autoCompleteTask = new ScheduledTask({
    id: AUTO_COMPLETE_TASK_ID,
    description: 'Scan Delivered orders past completion deadline and mark Completed',
    schedule: cron => cron.every(5).minutes(),
    async execute({ injector, scheduledContext }) {
        const service = injector.get(OrderCompleteAutoService);
        await service.runAutoCompleteScan(scheduledContext);
    },
});

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}
import { LogisticsShopResolver } from './logistics-shop.resolver';
import { OrderPackageShopResolver } from './order-package-shop.resolver';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
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

const shopSchema = () => gql`
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

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [LogisticsTrack, OrderPackage],
    providers: [
        { provide: LOGISTICS_PLUGIN_OPTIONS, useFactory: () => LogisticsPlugin.options },
        LogisticsService,
        AutoSplitPlanService,
        ManualSplitAdjustService,
        OrderPackageService,
        OrderCompleteAutoService,
        // 字符串 token：供 delivery-gateway-plugin 通过注入器 duck-typing 解耦调用（挂钩点3）
        { provide: 'OrderPackageLinker', useExisting: OrderPackageService },
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [LogisticsAdminResolver, SplitAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [LogisticsShopResolver, OrderPackageShopResolver],
    },
    configuration: (config) => {
        config.customFields.Fulfillment = mergeCustomFields(config.customFields.Fulfillment, logisticsFulfillmentCustomFields.Fulfillment);
        config.customFields.Channel = mergeCustomFields(config.customFields.Channel, logisticsChannelCustomFields.Channel);
        config.customFields.Product = mergeCustomFields(config.customFields.Product, catalogCustomFields.Product);
        config.customFields.StockLocation = mergeCustomFields(config.customFields.StockLocation, catalogCustomFields.StockLocation);
        config.customFields.Order = mergeCustomFields(config.customFields.Order, catalogCustomFields.Order);
        config.customFields.OrderLine = mergeCustomFields(config.customFields.OrderLine, catalogCustomFields.OrderLine);
        config.orderOptions.stockAllocationStrategy = new ChannelStockAllocationStrategy();
        // 库存策略矩阵：单一全局入口（就近/优先级/库存优先/会员专属），余量天然拆单
        config.catalogOptions.stockLocationStrategy = new MatrixStockLocationStrategy();
        // 每包裹独立计费：读 stockLocationsJson 逐包计费合计（channel.packageShippingRule）
        config.shippingOptions.shippingCalculators = [
            ...(config.shippingOptions.shippingCalculators || []),
            splitShippingCalculator,
        ];
        // 履约闭环：包裹聚合驱动订单状态机（禁用 checkFulfillmentStates，city 包无 fulfillment 不拦截）
        if (!(config.orderOptions.process ?? []).some(p => (p as any).__logisticsClosure)) {
            config.orderOptions.process = [
                configureDefaultOrderProcess({ checkFulfillmentStates: false }),
                { ...orderCompletionProcess, __logisticsClosure: true } as any,
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
})
export class LogisticsPlugin implements OnApplicationBootstrap {
    private static options: LogisticsPluginOptions = {};
    private injector: Injector;

    constructor(
        @Inject(LOGISTICS_PLUGIN_OPTIONS) private options: LogisticsPluginOptions,
        private logisticsService: LogisticsService,
        private autoSplit: AutoSplitPlanService,
        private manualSplit: ManualSplitAdjustService,
        private orderPackageService: OrderPackageService,
        private orderCompleteAuto: OrderCompleteAutoService,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin> {
        LogisticsPlugin.options = options ?? {};
        return LogisticsPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.logisticsService.init(this.injector);
        this.autoSplit.init(this.injector);
        this.manualSplit.init(this.injector);
        this.orderPackageService.init(this.injector);
        this.orderCompleteAuto.init(this.injector);
        // Task4 每包独立计费：库存分配在进入 ArrangingPayment 时才写 stockLocationsJson，
        // 而计费时点（setOrderShippingMethod）早于分配 → 运费先按 0 落库。
        // 在此监听 ArrangingPayment 过渡（onTransitionEnd 已分配库存），按拆分明细重算运费并落库 packageShippingJson。
        this.injector
            .get(EventBus)
            .ofType(OrderStateTransitionEvent)
            .subscribe(async event => {
                if (event.toState !== 'ArrangingPayment') {
                    return;
                }
                await this.recalcSplitShipping(event.ctx, event.order.id);
            });
        Logger.info('LogisticsPlugin initialized', loggerCtx);
    }

    /**
     * 重算拆单订单运费：仅在存在 stockLocationsJson 拆分明细时触发，
     * 使 SplitShippingCalculator 按已落库的每包明细计费并写入 Order.packageShippingJson / shippingWithTax。
     */
    private async recalcSplitShipping(ctx: RequestContext, orderId: ID): Promise<void> {
        try {
            const orderService = this.injector.get(OrderService);
            const order = await orderService.findOne(ctx, orderId);
            if (!order || !(order.shippingLines?.length)) {
                return;
            }
            const hasSplit = (order.lines ?? []).some((line: OrderLine & { customFields?: any }) => {
                const raw = (line.customFields as any)?.stockLocationsJson;
                if (!raw) {
                    return false;
                }
                try {
                    const arr = JSON.parse(String(raw));
                    return Array.isArray(arr) && arr.length > 0;
                } catch {
                    return false;
                }
            });
            if (!hasSplit) {
                return;
            }
            const updated = await orderService.applyPriceAdjustments(ctx, order);
            await this.injector.get(TransactionalConnection).getRepository(ctx, Order).save(updated, { reload: false });
            Logger.info(`拆单运费重算 order#${order.code ?? orderId} -> shippingWithTax=${updated.shippingWithTax}`, loggerCtx);
        } catch (e: any) {
            Logger.warn(`拆单运费重算失败 order#${orderId}: ${e?.message ?? e}`, loggerCtx);
        }
    }
}
