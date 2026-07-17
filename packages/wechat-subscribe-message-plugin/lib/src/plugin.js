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
var WechatSubscribeMessagePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatSubscribeMessagePlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const channel_custom_fields_1 = require("./channel-custom-fields");
const constants_1 = require("./constants");
const default_wechat_message_provider_1 = require("./default-wechat-message-provider");
const subscribe_message_admin_resolver_1 = require("./subscribe-message-admin.resolver");
const subscribe_message_log_entity_1 = require("./subscribe-message-log.entity");
const subscribe_message_service_1 = require("./subscribe-message.service");
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
    type SubscribeMessageLog implements Node {
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
let WechatSubscribeMessagePlugin = WechatSubscribeMessagePlugin_1 = class WechatSubscribeMessagePlugin {
    constructor(options, subscribeMessageService, eventBus) {
        this.options = options;
        this.subscribeMessageService = subscribeMessageService;
        this.eventBus = eventBus;
    }
    static init(options) {
        WechatSubscribeMessagePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return WechatSubscribeMessagePlugin_1;
    }
    async onApplicationBootstrap() {
        this.eventBus.ofType(core_1.PaymentStateTransitionEvent).subscribe(event => {
            if (event.toState !== 'Settled')
                return;
            void this.handleOrderPaid(event);
        });
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe(event => {
            if (event.toState === 'Shipped') {
                void this.handleOrderShipped(event);
            }
            else if (event.toState === 'Delivered') {
                void this.handleOrderDelivered(event);
            }
        });
        this.eventBus.ofType(core_1.RefundStateTransitionEvent).subscribe(event => {
            if (event.toState !== 'Settled')
                return;
            void this.handleOrderRefunded(event);
        });
        core_1.Logger.info('WechatSubscribeMessagePlugin initialized', constants_1.loggerCtx);
    }
    async handleOrderPaid(event) {
        var _a;
        try {
            await this.subscribeMessageService.sendOrderPaidMessage(event.ctx, event.order);
        }
        catch (e) {
            core_1.Logger.error(`Failed to send order paid message for order ${event.order.code}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    }
    async handleOrderShipped(event) {
        var _a;
        try {
            await this.subscribeMessageService.sendOrderShippedMessage(event.ctx, event.order);
        }
        catch (e) {
            core_1.Logger.error(`Failed to send order shipped message for order ${event.order.code}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    }
    async handleOrderDelivered(event) {
        var _a;
        try {
            await this.subscribeMessageService.sendOrderDeliveredMessage(event.ctx, event.order);
        }
        catch (e) {
            core_1.Logger.error(`Failed to send order delivered message for order ${event.order.code}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    }
    async handleOrderRefunded(event) {
        var _a;
        try {
            await this.subscribeMessageService.sendOrderRefundedMessage(event.ctx, event.order, event.refund);
        }
        catch (e) {
            core_1.Logger.error(`Failed to send order refunded message for order ${event.order.code}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    }
};
exports.WechatSubscribeMessagePlugin = WechatSubscribeMessagePlugin;
WechatSubscribeMessagePlugin.options = {};
exports.WechatSubscribeMessagePlugin = WechatSubscribeMessagePlugin = WechatSubscribeMessagePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [subscribe_message_log_entity_1.SubscribeMessageLog],
        providers: [
            { provide: constants_1.SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS, useFactory: () => WechatSubscribeMessagePlugin.options },
            {
                provide: constants_1.WECHAT_MESSAGE_PROVIDER,
                useFactory: (options) => {
                    var _a;
                    const ProviderClass = (_a = options === null || options === void 0 ? void 0 : options.provider) !== null && _a !== void 0 ? _a : default_wechat_message_provider_1.DefaultWechatMessageProvider;
                    return new ProviderClass();
                },
                inject: [constants_1.SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS],
            },
            subscribe_message_service_1.SubscribeMessageService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [subscribe_message_admin_resolver_1.SubscribeMessageAdminResolver],
        },
        configuration: config => {
            var _a, _b, _c;
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Channel: [
                    ...((_b = (_a = config.customFields) === null || _a === void 0 ? void 0 : _a.Channel) !== null && _b !== void 0 ? _b : []),
                    ...((_c = channel_custom_fields_1.subscribeMessageChannelCustomFields.Channel) !== null && _c !== void 0 ? _c : []),
                ] });
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, subscribe_message_service_1.SubscribeMessageService,
        core_1.EventBus])
], WechatSubscribeMessagePlugin);
//# sourceMappingURL=plugin.js.map