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
var WechatShoppingAssistantPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatShoppingAssistantPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const meilisearch_plugin_1 = require("@vendure/meilisearch-plugin");
const wechat_auth_plugin_1 = require("@vendure/wechat-auth-plugin");
const address_service_1 = require("./address.service");
const assistant_service_1 = require("./assistant.service");
const assistant_http_controller_1 = require("./assistant-http.controller");
const city_catalog_service_1 = require("./city/city-catalog.service");
const delivery_guard_service_1 = require("./city/delivery-guard.service");
const tenant_router_service_1 = require("./city/tenant-router.service");
const constants_1 = require("./constants");
const credential_service_1 = require("./credential.service");
const customer_binding_service_1 = require("./customer-binding.service");
const wechat_processed_message_entity_1 = require("./entities/wechat-processed-message.entity");
const wechat_shopping_session_entity_1 = require("./entities/wechat-shopping-session.entity");
const wechat_support_ticket_entity_1 = require("./entities/wechat-support-ticket.entity");
const geo_service_1 = require("./geo.service");
const order_service_1 = require("./order.service");
const search_adapter_1 = require("./search-adapter");
const session_service_1 = require("./session.service");
const shopping_session_flow_columns_migration_1 = require("./migrations/shopping-session-flow-columns.migration");
const store_locator_service_1 = require("./store-locator.service");
const support_ticket_admin_resolver_1 = require("./support-ticket-admin.resolver");
const support_ticket_service_1 = require("./support-ticket.service");
const wechat_sender_1 = require("./wechat-sender");
const { gql } = require('graphql-tag');
/** 留言工单后台 schema：列表 + 回复（回复经公众号客服消息下发） */
const adminSchema = () => gql `
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
let WechatShoppingAssistantPlugin = WechatShoppingAssistantPlugin_1 = class WechatShoppingAssistantPlugin {
    constructor(options, eventBus, assistantService, sender) {
        this.options = options;
        this.eventBus = eventBus;
        this.assistantService = assistantService;
        this.sender = sender;
    }
    static init(options) {
        WechatShoppingAssistantPlugin_1.options = options;
        return WechatShoppingAssistantPlugin_1;
    }
    async onApplicationBootstrap() {
        this.sender.setEchoMode(this.options.outboundMode === 'echo');
        this.eventBus.ofType(wechat_auth_plugin_1.WechatMessageEvent).subscribe(event => {
            void this.assistantService.onMessage(event);
        });
        core_1.Logger.info('WechatShoppingAssistantPlugin initialized', constants_1.loggerCtx);
    }
};
exports.WechatShoppingAssistantPlugin = WechatShoppingAssistantPlugin;
exports.WechatShoppingAssistantPlugin = WechatShoppingAssistantPlugin = WechatShoppingAssistantPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule, meilisearch_plugin_1.MeiliSearchPlugin, wechat_auth_plugin_1.WechatAuthPlugin],
        entities: [wechat_shopping_session_entity_1.WechatShoppingSession, wechat_processed_message_entity_1.WechatProcessedMessage, wechat_support_ticket_entity_1.WechatSupportTicket],
        controllers: [assistant_http_controller_1.AssistantHttpController],
        adminApiExtensions: { schema: adminSchema, resolvers: [support_ticket_admin_resolver_1.SupportTicketAdminResolver] },
        providers: [
            { provide: constants_1.WECHAT_ASSISTANT_PLUGIN_OPTIONS, useFactory: () => WechatShoppingAssistantPlugin.options },
            session_service_1.SessionService,
            search_adapter_1.AssistantSearchService,
            order_service_1.AssistantOrderService,
            credential_service_1.CredentialService,
            wechat_sender_1.WechatSender,
            assistant_service_1.AssistantService,
            customer_binding_service_1.CustomerBindingService,
            address_service_1.AddressBookService,
            geo_service_1.GeoService,
            store_locator_service_1.StoreLocatorService,
            support_ticket_service_1.SupportTicketService,
            shopping_session_flow_columns_migration_1.ShoppingSessionFlowColumnsMigration,
            city_catalog_service_1.CityCatalogService,
            tenant_router_service_1.TenantRouterService,
            delivery_guard_service_1.DeliveryGuardService,
        ],
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.WECHAT_ASSISTANT_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.EventBus,
        assistant_service_1.AssistantService,
        wechat_sender_1.WechatSender])
], WechatShoppingAssistantPlugin);
//# sourceMappingURL=plugin.js.map