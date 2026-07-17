import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    EventBus,
    Logger,
    OrderStateTransitionEvent,
    PaymentStateTransitionEvent,
    PluginCommonModule,
    RefundStateTransitionEvent,
    VendurePlugin,
} from '@vendure/core';

import { subscribeMessageChannelCustomFields } from './channel-custom-fields';
import { SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS, WECHAT_MESSAGE_PROVIDER, loggerCtx } from './constants';
import { DefaultWechatMessageProvider } from './default-wechat-message-provider';
import { SubscribeMessageAdminResolver } from './subscribe-message-admin.resolver';
import { SubscribeMessageLog } from './subscribe-message-log.entity';
import { SubscribeMessageService } from './subscribe-message.service';
import { WechatSubscribeMessagePluginOptions } from './types';
import { WechatMessageProvider } from './wechat-message-provider';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type SubscribeMessageLog {
        id: ID!
        customerId: ID!
        openid: String!
        templateId: String!
        status: String!
        page: String
        miniprogramState: String
        errorMsg: String
        msgId: String
        sentAt: DateTime
        createdAt: DateTime!
    }

    type SubscribeMessageLogList implements PaginatedList {
        items: [SubscribeMessageLog!]!
        totalItems: Int!
    }

    input SubscribeMessageLogListOptions {
        skip: Int
        take: Int
        sort: SubscribeMessageLogSortParameter
        filter: SubscribeMessageLogFilterParameter
    }

    input SubscribeMessageLogSortParameter {
        id: SortOrder
        customerId: SortOrder
        templateId: SortOrder
        status: SortOrder
        createdAt: SortOrder
        sentAt: SortOrder
    }

    input SubscribeMessageLogFilterParameter {
        customerId: String
        status: String
        templateId: String
    }

    extend type Query {
        subscribeMessageLogs(options: SubscribeMessageLogListOptions): SubscribeMessageLogList!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [SubscribeMessageLog],
    providers: [
        { provide: SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS, useFactory: () => WechatSubscribeMessagePlugin.options },
        {
            provide: WECHAT_MESSAGE_PROVIDER,
            useFactory: (options: WechatSubscribeMessagePluginOptions) => {
                const ProviderClass = options?.provider ?? DefaultWechatMessageProvider;
                return new ProviderClass() as WechatMessageProvider;
            },
            inject: [SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS],
        },
        SubscribeMessageService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [SubscribeMessageAdminResolver],
    },
    configuration: config => {
        config.customFields = {
            ...config.customFields,
            Channel: [
                ...(config.customFields?.Channel ?? []),
                ...(subscribeMessageChannelCustomFields.Channel ?? []),
            ],
        };
        return config;
    },
    compatibility: '^3.0.0',
})
export class WechatSubscribeMessagePlugin implements OnApplicationBootstrap {
    private static options: WechatSubscribeMessagePluginOptions = {};

    constructor(
        @Inject(SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS) private options: WechatSubscribeMessagePluginOptions,
        private subscribeMessageService: SubscribeMessageService,
        private eventBus: EventBus,
    ) {}

    static init(options?: WechatSubscribeMessagePluginOptions): Type<WechatSubscribeMessagePlugin> {
        WechatSubscribeMessagePlugin.options = options ?? {};
        return WechatSubscribeMessagePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.eventBus.ofType(PaymentStateTransitionEvent).subscribe(event => {
            if (event.toState !== 'Settled') return;
            void this.handleOrderPaid(event);
        });

        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(event => {
            if (event.toState === 'Shipped') {
                void this.handleOrderShipped(event);
            } else if (event.toState === 'Delivered') {
                void this.handleOrderDelivered(event);
            }
        });

        this.eventBus.ofType(RefundStateTransitionEvent).subscribe(event => {
            if (event.toState !== 'Settled') return;
            void this.handleOrderRefunded(event);
        });

        Logger.info('WechatSubscribeMessagePlugin initialized', loggerCtx);
    }

    private async handleOrderPaid(event: PaymentStateTransitionEvent): Promise<void> {
        try {
            await this.subscribeMessageService.sendOrderPaidMessage(event.ctx, event.order);
        } catch (e: any) {
            Logger.error(
                `Failed to send order paid message for order ${event.order.code}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }

    private async handleOrderShipped(event: OrderStateTransitionEvent): Promise<void> {
        try {
            await this.subscribeMessageService.sendOrderShippedMessage(event.ctx, event.order);
        } catch (e: any) {
            Logger.error(
                `Failed to send order shipped message for order ${event.order.code}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }

    private async handleOrderDelivered(event: OrderStateTransitionEvent): Promise<void> {
        try {
            await this.subscribeMessageService.sendOrderDeliveredMessage(event.ctx, event.order);
        } catch (e: any) {
            Logger.error(
                `Failed to send order delivered message for order ${event.order.code}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }

    private async handleOrderRefunded(event: RefundStateTransitionEvent): Promise<void> {
        try {
            await this.subscribeMessageService.sendOrderRefundedMessage(
                event.ctx,
                event.order,
                event.refund,
            );
        } catch (e: any) {
            Logger.error(
                `Failed to send order refunded message for order ${event.order.code}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }
}
