import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    EventBus,
    Injector,
    Logger,
    OrderStateTransitionEvent,
    PluginCommonModule,
    TransactionalConnection,
    VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';

import { PAYMENT_SCHEDULE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { OrderPaymentSchedule } from './order-payment-schedule.entity';
import { OrderScheduleItem } from './order-schedule-item.entity';
import { PaymentScheduleAdminResolver } from './payment-schedule-admin.resolver';
import { paymentScheduleOrderCustomFields } from './order-custom-fields';
import { PaymentScheduleJob, paymentScheduleTask } from './payment-schedule.job';
import { paymentScheduleOrderProcess } from './payment-schedule.order-process';
import { PaymentScheduleService } from './payment-schedule.service';
import { setPaymentScheduleRuntime } from './payment-schedule-runtime';
import { PaymentScheduleShopResolver } from './payment-schedule-shop.resolver';
import { PaymentSchedulePluginOptions } from './types';

/** 幂等合并 customFields（防 preBootstrapConfig 重复注册），与 pre-sale 同款 */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [OrderPaymentSchedule, OrderScheduleItem],
    providers: [
        { provide: PAYMENT_SCHEDULE_PLUGIN_OPTIONS, useFactory: () => PaymentSchedulePlugin.options },
        PaymentScheduleService,
        PaymentScheduleAdminResolver,
        PaymentScheduleShopResolver,
        // 供 ScheduledTask injector.get(PaymentScheduleJob)
        PaymentScheduleJob,
    ],
    exports: [PaymentScheduleService],
    adminApiExtensions: {
        schema: () => gql`
            enum PaymentScheduleScenario { presale installment rental }
            enum PaymentScheduleStatus { pending in_progress completed breached cancelled }
            enum PaymentScheduleBreachType { buyer_timeout seller_breach group_buy_failed }
            enum PaymentScheduleItemStatus { locked payable paid overdue forfeited refunded waived }
            enum PaymentScheduleItemKind { deposit balance down_payment installment rent buyout }

            type PaymentScheduleItem implements Node {
                id: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
                seq: Int!
                kind: PaymentScheduleItemKind!
                amount: Int!
                paidAmount: Int!
                allowCod: Boolean!
                status: PaymentScheduleItemStatus!
                dueAt: DateTime
                graceHours: Int!
                trigger: JSON!
                paidAt: DateTime
                lateFeeAccrued: Int!
            }

            type PaymentSchedule implements Node {
                id: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
                orderId: ID!
                scenario: PaymentScheduleScenario!
                status: PaymentScheduleStatus!
                breachType: PaymentScheduleBreachType
                depositRule: JSON
                deliveryGate: String!
                agreementVersion: String!
                shipDeadline: DateTime
                meta: JSON
                items: [PaymentScheduleItem!]!
                paidTotal: Int!
                totalAmount: Int!
            }

            input PaymentScheduleListOptions

            type PaymentScheduleList implements PaginatedList {
                items: [PaymentSchedule!]!
                totalItems: Int!
            }

            extend type Query {
                paymentSchedules(options: PaymentScheduleListOptions): PaymentScheduleList!
                adminPaymentSchedule(id: ID!): PaymentSchedule
            }

            extend type Mutation {
                openTailWindow(scheduleId: ID!): PaymentSchedule!
                confirmSellerBreach(scheduleId: ID!): PaymentSchedule!
                confirmCodReceived(orderId: ID!): PaymentSchedule!
                releaseRentalDeposit(orderId: ID!): PaymentSchedule!
                runScheduleScan: PaymentScheduleScanResult!
            }

            type PaymentScheduleScanResult {
                activated: Int!
                overdue: Int!
                shipBreaches: Int!
            }
        `,
        resolvers: [PaymentScheduleAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            enum PaymentScheduleScenario { presale installment rental }
            enum PaymentScheduleStatus { pending in_progress completed breached cancelled }
            enum PaymentScheduleBreachType { buyer_timeout seller_breach group_buy_failed }
            enum PaymentScheduleItemStatus { locked payable paid overdue forfeited refunded waived }
            enum PaymentScheduleItemKind { deposit balance down_payment installment rent buyout }

            type PaymentScheduleItem implements Node {
                id: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
                seq: Int!
                kind: PaymentScheduleItemKind!
                amount: Int!
                paidAmount: Int!
                allowCod: Boolean!
                status: PaymentScheduleItemStatus!
                dueAt: DateTime
                graceHours: Int!
                trigger: JSON!
                paidAt: DateTime
                lateFeeAccrued: Int!
            }

            type PaymentSchedule implements Node {
                id: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
                orderId: ID!
                scenario: PaymentScheduleScenario!
                status: PaymentScheduleStatus!
                breachType: PaymentScheduleBreachType
                depositRule: JSON
                deliveryGate: String!
                agreementVersion: String!
                shipDeadline: DateTime
                meta: JSON
                items: [PaymentScheduleItem!]!
                paidTotal: Int!
                totalAmount: Int!
            }

            extend type Query {
                paymentSchedule(orderId: ID!): PaymentSchedule
            }

            extend type Mutation {
                paySchedulePeriod(orderId: ID!, seq: Int!, method: String!): PaymentSchedule!
                cancelSchedule(orderId: ID!, confirmForfeit: Boolean): PaymentSchedule!
            }
        `,
        resolvers: [PaymentScheduleShopResolver],
    },
    configuration: config => {
        config.customFields.Order = mergeCustomFields(config.customFields.Order, paymentScheduleOrderCustomFields.Order);

        const orderProcesses = config.orderOptions?.process ?? [];
        const registered = orderProcesses.some((p: any) => (p as any).__paymentScheduleRegistered);
        if (!registered) {
            (paymentScheduleOrderProcess as any).__paymentScheduleRegistered = true;
            config.orderOptions.process = [...orderProcesses, paymentScheduleOrderProcess];
        }

        if (!config.schedulerOptions) {
            config.schedulerOptions = { tasks: [] } as any;
        }
        if (!config.schedulerOptions.tasks) {
            config.schedulerOptions.tasks = [];
        }
        config.schedulerOptions.tasks.push(paymentScheduleTask);

        return config;
    },
    compatibility: '^3.0.0',
})
export class PaymentSchedulePlugin implements OnApplicationBootstrap {
    private static options: PaymentSchedulePluginOptions = {};
    private injector!: Injector;

    constructor(
        @Inject(PAYMENT_SCHEDULE_PLUGIN_OPTIONS) private options: PaymentSchedulePluginOptions,
        private scheduleService: PaymentScheduleService,
        private eventBus: EventBus,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: PaymentSchedulePluginOptions): Type<PaymentSchedulePlugin> {
        PaymentSchedulePlugin.options = options ?? {};
        return PaymentSchedulePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        setPaymentScheduleRuntime(this.injector.get(TransactionalConnection), this.injector);
        this.scheduleService.init(this.injector);

        // 订单取消 → 调度联动（未付期次 waived、调度 cancelled）
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async event => {
            if (event.toState !== 'Cancelled') return;
            if (!(event.order as any)?.customFields?.paymentScheduleId) return;
            try {
                await this.scheduleService.handleOrderCancelled(event.ctx, event.order.id);
            } catch (e: any) {
                Logger.error(`Failed to handle schedule on order cancel: ${e.message}`, loggerCtx);
            }
        });

        // 团购领域事件桥（软依赖 group-buy-plugin）
        this.registerGroupBuyBridge();

        Logger.info('PaymentSchedulePlugin initialized', loggerCtx);
    }

    private registerGroupBuyBridge(): void {
        try {
            const gb = require('@vendure/group-buy-plugin');
            this.eventBus.ofType(gb.GroupBuyCompletedEvent).subscribe((e: any) =>
                this.scheduleService.handleGroupBuyCompleted(e.ctx, e.activityId).catch((err: any) => {
                    Logger.error(`GroupBuyCompleted schedule handling failed: ${err.message}`, loggerCtx);
                }),
            );
            this.eventBus.ofType(gb.GroupBuyFailedEvent).subscribe((e: any) =>
                this.scheduleService.handleGroupBuyFailed(e.ctx, e.activityId).catch((err: any) => {
                    Logger.error(`GroupBuyFailed schedule handling failed: ${err.message}`, loggerCtx);
                }),
            );
            Logger.info('Group-buy event bridge registered', loggerCtx);
        } catch {
            Logger.info('group-buy-plugin not installed, group_buy triggers use scanner only', loggerCtx);
        }
    }
}
