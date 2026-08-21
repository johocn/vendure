import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    EventBus,
    Injector,
    OrderStateTransitionEvent,
    PluginCommonModule,
    RefundStateTransitionEvent,
    VendurePlugin,
} from '@vendure/core';

import { NOTIFICATION_PLUGIN_OPTIONS } from './constants';
import { InboxMessage } from './inbox-message.entity';
import { NotificationAdminResolver } from './notification-admin.resolver';
import { NotificationShopResolver } from './notification-shop.resolver';
import { NotificationService } from './notification.service';
import { NotifierProvider } from './notifier/notifier-provider';
import { NotificationPluginOptions } from './types';
import { WechatNotifierProvider } from './wechat-notifier-provider';

const { gql } = require('graphql-tag');

/** 站内信与列表类型，shop/admin 两套 schema 各需自包含定义（两套 API 独立合并）。 */
const inboxTypeDefs = `
    type InboxMessage implements Node {
        id: ID!
        scene: String!
        title: String!
        content: String!
        link: String
        isRead: Boolean!
        createdAt: DateTime!
    }

    type InboxMessageList {
        items: [InboxMessage!]!
        totalItems: Int!
    }
`;

const shopSchema = () => gql`
    ${inboxTypeDefs}

    extend type Query {
        myInbox: InboxMessageList!
        inboxUnreadCount: Int!
    }

    extend type Mutation {
        markInboxRead(id: ID!): InboxMessage!
    }
`;

const adminSchema = () => gql`
    ${inboxTypeDefs}

    extend type Query {
        adminInbox: InboxMessageList!
        adminInboxUnreadCount: Int!
    }

    extend type Mutation {
        markAdminInboxRead(id: ID!): InboxMessage!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [InboxMessage],
    providers: [
        { provide: NOTIFICATION_PLUGIN_OPTIONS, useFactory: () => NotificationPlugin.options },
        NotificationService,
        WechatNotifierProvider,
    ],
    shopApiExtensions: { schema: shopSchema, resolvers: [NotificationShopResolver] },
    adminApiExtensions: { schema: adminSchema, resolvers: [NotificationAdminResolver] },
    compatibility: '^3.0.0',
})
export class NotificationPlugin implements OnApplicationBootstrap {
    private static options: NotificationPluginOptions = {};

    constructor(
        @Inject(NOTIFICATION_PLUGIN_OPTIONS) private options: NotificationPluginOptions,
        private eventBus: EventBus,
        private notificationService: NotificationService,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: NotificationPluginOptions): Type<NotificationPlugin> {
        NotificationPlugin.options = options ?? {};
        return NotificationPlugin;
    }

    onApplicationBootstrap(): void {
        // Injector 无法作为 DI token 直接注入，需经 ModuleRef 构造（与 group-buy-plugin 一致）。
        const injector = new Injector(this.moduleRef);
        const notifier: NotifierProvider = this.options.notifierProvider
            ? injector.get(this.options.notifierProvider)
            : injector.get(WechatNotifierProvider);
        this.notificationService.init(notifier);

        this.eventBus.ofType(OrderStateTransitionEvent).subscribe((event) => {
            const ctx = event.ctx;
            void this.notificationService.onOrderStateTransition(ctx, event.order.id, event.toState);
        });

        this.eventBus.ofType(RefundStateTransitionEvent).subscribe((event) => {
            if (event.toState !== 'Settled') return;
            void this.notificationService.onRefundSettled(event.ctx, event.order.id, event.refund.total);
        });
    }
}