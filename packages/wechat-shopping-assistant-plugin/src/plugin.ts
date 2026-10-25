import { Inject, Type } from '@nestjs/common';
import { EventBus, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { MeiliSearchPlugin } from '@vendure/meilisearch-plugin';
import { WechatAuthPlugin, WechatMessageEvent } from '@vendure/wechat-auth-plugin';

import { AddressBookService } from './address.service';
import { AssistantService } from './assistant.service';
import { AssistantHttpController } from './assistant-http.controller';
import { loggerCtx, WECHAT_ASSISTANT_PLUGIN_OPTIONS } from './constants';
import { CredentialService } from './credential.service';
import { CustomerBindingService } from './customer-binding.service';
import { WechatProcessedMessage } from './entities/wechat-processed-message.entity';
import { WechatShoppingSession } from './entities/wechat-shopping-session.entity';
import { WechatSupportTicket } from './entities/wechat-support-ticket.entity';
import { GeoService } from './geo.service';
import { AssistantOrderService } from './order.service';
import { AssistantSearchService } from './search-adapter';
import { SessionService } from './session.service';
import { ShoppingSessionFlowColumnsMigration } from './migrations/shopping-session-flow-columns.migration';
import { StoreLocatorService } from './store-locator.service';
import { SupportTicketAdminResolver } from './support-ticket-admin.resolver';
import { SupportTicketService } from './support-ticket.service';
import { WechatShoppingAssistantOptions } from './types';
import { WechatSender } from './wechat-sender';

const { gql } = require('graphql-tag');

/** 留言工单后台 schema：列表 + 回复（回复经公众号客服消息下发） */
const adminSchema = () => gql`
    type WechatSupportTicket implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        openid: String!
        channelId: ID
        customerId: ID
        storeId: String
        storeName: String
        summary: String
        content: String!
        status: String!
        reply: String
        repliedAt: DateTime
    }

    extend type Query {
        wechatSupportTickets(limit: Int = 20, status: String): [WechatSupportTicket!]!
    }

    extend type Mutation {
        replyWechatSupportTicket(id: ID!, content: String!): WechatSupportTicket!
    }
`;

/**
 * 微信公众号购物助手：
 * 用户发「买一瓶酱油」→ meili 商品搜索 → 客服消息图文卡片（失败降级文本列表）
 * → 回复「买1」→ 校验绑定/库存 → 创建订单 → 回复订单确认 + H5 收银台支付链接。
 *
 * 依赖：WechatAuthPlugin（消息回调事件 + 客服消息 API）、MeiliSearchPlugin（商品索引）。
 * 须与 WechatAuthPlugin 同时注册（见 dev-config 条件装配）。
 */
@VendurePlugin({
    imports: [PluginCommonModule, MeiliSearchPlugin, WechatAuthPlugin],
    entities: [WechatShoppingSession, WechatProcessedMessage, WechatSupportTicket],
    controllers: [AssistantHttpController],
    adminApiExtensions: { schema: adminSchema, resolvers: [SupportTicketAdminResolver] },
    providers: [
        { provide: WECHAT_ASSISTANT_PLUGIN_OPTIONS, useFactory: () => WechatShoppingAssistantPlugin.options },
        SessionService,
        AssistantSearchService,
        AssistantOrderService,
        CredentialService,
        WechatSender,
        AssistantService,
        CustomerBindingService,
        AddressBookService,
        GeoService,
        StoreLocatorService,
        SupportTicketService,
        ShoppingSessionFlowColumnsMigration,
    ],
    compatibility: '^3.0.0',
})
export class WechatShoppingAssistantPlugin {
    static options: WechatShoppingAssistantOptions;

    constructor(
        @Inject(WECHAT_ASSISTANT_PLUGIN_OPTIONS) private options: WechatShoppingAssistantOptions,
        private eventBus: EventBus,
        private assistantService: AssistantService,
        private sender: WechatSender,
    ) {}

    static init(options: WechatShoppingAssistantOptions): Type<WechatShoppingAssistantPlugin> {
        WechatShoppingAssistantPlugin.options = options;
        return WechatShoppingAssistantPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.sender.setEchoMode(this.options.outboundMode === 'echo');
        this.eventBus.ofType(WechatMessageEvent).subscribe(event => {
            void this.assistantService.onMessage(event);
        });
        Logger.info('WechatShoppingAssistantPlugin initialized', loggerCtx);
    }
}
