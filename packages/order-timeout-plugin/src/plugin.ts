import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    EventBus,
    Logger,
    OrderStateTransitionEvent,
    PaymentStateTransitionEvent,
    PluginCommonModule,
    ScheduledTask,
    VendurePlugin,
} from '@vendure/core';

import { orderTimeoutChannelCustomFields } from './channel-custom-fields';
import { ORDER_TIMEOUT_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { OrderTimeoutJob } from './order-timeout.job';
import { OrderTimeoutTask, TimeoutType } from './order-timeout-task.entity';
import { OrderTimeoutPluginOptions } from './types';

const COMPENSATION_TASK_ID = 'order-timeout-compensation';

const compensationTask = new ScheduledTask({
    id: COMPENSATION_TASK_ID,
    description: 'Scan overdue OrderTimeoutTask records and re-enqueue them',
    schedule: cron => cron.every(5).minutes(),
    async execute({ injector }) {
        const job = injector.get(OrderTimeoutJob);
        await job.runCompensation();
    },
});

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [OrderTimeoutTask],
    providers: [
        { provide: ORDER_TIMEOUT_PLUGIN_OPTIONS, useFactory: () => OrderTimeoutPlugin.options },
        OrderTimeoutJob,
    ],
    configuration: (config) => {
        config.customFields.Channel = [
            ...(config.customFields.Channel ?? []),
            ...(orderTimeoutChannelCustomFields.Channel ?? []),
        ];
        const exists = config.schedulerOptions.tasks.some(t => t.id === COMPENSATION_TASK_ID);
        if (!exists) {
            config.schedulerOptions.tasks.push(compensationTask);
        }
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class OrderTimeoutPlugin implements OnApplicationBootstrap {
    private static options: OrderTimeoutPluginOptions = {};

    constructor(
        @Inject(ORDER_TIMEOUT_PLUGIN_OPTIONS) private options: OrderTimeoutPluginOptions,
        private orderTimeoutJob: OrderTimeoutJob,
        private eventBus: EventBus,
    ) {}

    static init(options?: OrderTimeoutPluginOptions): Type<OrderTimeoutPlugin> {
        OrderTimeoutPlugin.options = options ?? {};
        return OrderTimeoutPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.orderTimeoutJob.init();

        this.eventBus.ofType(OrderStateTransitionEvent).subscribe((event) => {
            const cf = (event.ctx.channel as any).customFields ?? {};
            const orderId = String(event.order.id);
            const channelId = String(event.ctx.channelId);

            if (event.toState === 'ArrangingPayment') {
                const minutes =
                    cf.orderPaymentTimeoutMinutes ?? this.options.defaultPaymentTimeoutMinutes ?? 30;
                void this.schedule(TimeoutType.PAYMENT, orderId, channelId, minutes * 60 * 1000);
            } else if (event.toState === 'Shipped') {
                const days = cf.orderReceiptTimeoutDays ?? this.options.defaultReceiptTimeoutDays ?? 15;
                void this.schedule(TimeoutType.RECEIPT, orderId, channelId, days * 24 * 60 * 60 * 1000);
            } else if (event.toState === 'Delivered') {
                const days = cf.orderReviewReminderDays ?? this.options.defaultReviewReminderDays ?? 7;
                void this.schedule(TimeoutType.REVIEW, orderId, channelId, days * 24 * 60 * 60 * 1000);
            }
        });

        this.eventBus.ofType(PaymentStateTransitionEvent).subscribe((event) => {
            if (event.toState !== 'Settled') return;
            const cf = (event.ctx.channel as any).customFields ?? {};
            const hours =
                cf.orderFulfillmentTimeoutHours ?? this.options.defaultFulfillmentTimeoutHours ?? 48;
            void this.schedule(
                TimeoutType.FULFILLMENT,
                String(event.order.id),
                String(event.ctx.channelId),
                hours * 60 * 60 * 1000,
            );
        });

        Logger.info('OrderTimeoutPlugin initialized', loggerCtx);
    }

    private async schedule(
        type: TimeoutType,
        orderId: string,
        channelId: string,
        timeoutMs: number,
    ): Promise<void> {
        try {
            await this.orderTimeoutJob.scheduleTimeout(type, orderId, channelId, timeoutMs);
        } catch (e: any) {
            Logger.error(
                `Failed to schedule ${type} timeout for order ${orderId}: ${String(e?.message ?? e)}`,
                loggerCtx,
            );
        }
    }
}
