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
var NotificationPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const inbox_message_entity_1 = require("./inbox-message.entity");
const notification_admin_resolver_1 = require("./notification-admin.resolver");
const notification_shop_resolver_1 = require("./notification-shop.resolver");
const notification_service_1 = require("./notification.service");
const wechat_notifier_provider_1 = require("./wechat-notifier-provider");
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
const shopSchema = () => gql `
    ${inboxTypeDefs}

    extend type Query {
        myInbox: InboxMessageList!
        inboxUnreadCount: Int!
    }

    extend type Mutation {
        markInboxRead(id: ID!): InboxMessage!
    }
`;
const adminSchema = () => gql `
    ${inboxTypeDefs}

    extend type Query {
        adminInbox: InboxMessageList!
        adminInboxUnreadCount: Int!
    }

    extend type Mutation {
        markAdminInboxRead(id: ID!): InboxMessage!
    }
`;
let NotificationPlugin = NotificationPlugin_1 = class NotificationPlugin {
    constructor(options, eventBus, notificationService, moduleRef) {
        this.options = options;
        this.eventBus = eventBus;
        this.notificationService = notificationService;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        NotificationPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return NotificationPlugin_1;
    }
    onApplicationBootstrap() {
        // Injector 无法作为 DI token 直接注入，需经 ModuleRef 构造（与 group-buy-plugin 一致）。
        const injector = new core_2.Injector(this.moduleRef);
        const notifier = this.options.notifierProvider
            ? injector.get(this.options.notifierProvider)
            : injector.get(wechat_notifier_provider_1.WechatNotifierProvider);
        this.notificationService.init(notifier);
        this.eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe((event) => {
            const ctx = event.ctx;
            void this.notificationService.onOrderStateTransition(ctx, event.order.id, event.toState);
        });
        this.eventBus.ofType(core_2.RefundStateTransitionEvent).subscribe((event) => {
            if (event.toState !== 'Settled')
                return;
            void this.notificationService.onRefundSettled(event.ctx, event.order.id, event.refund.total);
        });
    }
};
exports.NotificationPlugin = NotificationPlugin;
NotificationPlugin.options = {};
exports.NotificationPlugin = NotificationPlugin = NotificationPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [inbox_message_entity_1.InboxMessage],
        providers: [
            { provide: constants_1.NOTIFICATION_PLUGIN_OPTIONS, useFactory: () => NotificationPlugin.options },
            notification_service_1.NotificationService,
            wechat_notifier_provider_1.WechatNotifierProvider,
        ],
        shopApiExtensions: { schema: shopSchema, resolvers: [notification_shop_resolver_1.NotificationShopResolver] },
        adminApiExtensions: { schema: adminSchema, resolvers: [notification_admin_resolver_1.NotificationAdminResolver] },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.NOTIFICATION_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_2.EventBus,
        notification_service_1.NotificationService,
        core_1.ModuleRef])
], NotificationPlugin);
//# sourceMappingURL=plugin.js.map