import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus, Logger, OrderStateTransitionEvent, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { ORDER_TIMEOUT_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { OrderTimeoutPluginOptions } from './types';
import { orderTimeoutChannelCustomFields } from './channel-custom-fields';
import { OrderTimeoutJob } from './order-timeout.job';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: ORDER_TIMEOUT_PLUGIN_OPTIONS, useFactory: () => OrderTimeoutPlugin.options },
        OrderTimeoutJob,
    ],
    configuration: (config) => {
        config.customFields.Channel = [
            ...(config.customFields.Channel ?? []),
            ...orderTimeoutChannelCustomFields.Channel!,
        ];
        return config;
    },
    dashboard: './dashboard/index.tsx',
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
            if (event.toState === 'ArrangingPayment') {
                const timeoutMinutes = (event.ctx.channel as any).customFields?.orderTimeoutMinutes
                    ?? this.options.defaultTimeoutMinutes
                    ?? 30;
                this.orderTimeoutJob.scheduleCancellation(
                    event.order.id as string,
                    event.ctx.channelId as string,
                    timeoutMinutes,
                );
                Logger.info(`Scheduled timeout for order ${event.order.id} in ${timeoutMinutes} minutes`, loggerCtx);
            }
        });
    }
}
