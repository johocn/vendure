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
var RechargeCardPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RechargeCardPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const recharge_card_entity_1 = require("./recharge-card.entity");
const recharge_card_batch_entity_1 = require("./recharge-card-batch.entity");
const customer_balance_entity_1 = require("./customer-balance.entity");
const balance_transaction_entity_1 = require("./balance-transaction.entity");
const recharge_order_entity_1 = require("./recharge-order.entity");
const recharge_card_service_1 = require("./recharge-card.service");
const recharge_order_resolver_1 = require("./recharge-order.resolver");
const balance_payment_handler_1 = require("./balance-payment-handler");
const recharge_card_shop_resolver_1 = require("./recharge-card-shop.resolver");
const recharge_card_admin_resolver_1 = require("./recharge-card-admin.resolver");
const wechatpay_plugin_1 = require("@vendure/wechatpay-plugin");
const { gql } = require('graphql-tag');
let RechargeCardPlugin = RechargeCardPlugin_1 = class RechargeCardPlugin {
    constructor(options, rechargeCardService, orderService, moduleRef) {
        this.options = options;
        this.rechargeCardService = rechargeCardService;
        this.orderService = orderService;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        RechargeCardPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return RechargeCardPlugin_1;
    }
    async onApplicationBootstrap() {
        (0, balance_payment_handler_1.setRechargeService)(this.rechargeCardService);
        (0, balance_payment_handler_1.setOrderService)(this.orderService);
        // 可选接入支付网关：进程内注册了 WechatpayPlugin 时解析到，否则保持独立可用
        const injector = new core_2.Injector(this.moduleRef);
        let registry = null;
        let gateway = null;
        try {
            gateway = injector.get(wechatpay_plugin_1.WechatpayService);
            registry = injector.get(wechatpay_plugin_1.WechatpaySettlementRegistry);
        }
        catch (e) {
            // 未注册网关 → 保持独立可用
        }
        (0, recharge_card_service_1.setWechatpayGateway)(gateway);
        if (registry) {
            const svc = this.rechargeCardService;
            registry.register({
                prefix: 'RC-',
                settle: (ctx, outTradeNo) => svc.settleRechargeOrderByOutTradeNo(ctx, outTradeNo),
            });
            core_2.Logger.info('RechargeOrder ~RC- settlement registered (wechatpay gateway)', constants_1.loggerCtx);
        }
        core_2.Logger.info('RechargeCardPlugin initialized', constants_1.loggerCtx);
    }
};
exports.RechargeCardPlugin = RechargeCardPlugin;
RechargeCardPlugin.options = {};
exports.RechargeCardPlugin = RechargeCardPlugin = RechargeCardPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [recharge_card_entity_1.RechargeCard, recharge_card_batch_entity_1.RechargeCardBatch, customer_balance_entity_1.CustomerBalance, balance_transaction_entity_1.BalanceTransaction, recharge_order_entity_1.RechargeOrder],
        providers: [
            { provide: constants_1.RECHARGE_CARD_PLUGIN_OPTIONS, useFactory: () => RechargeCardPlugin.options },
            recharge_card_service_1.RechargeCardService,
        ],
        shopApiExtensions: {
            schema: () => gql `
            type RechargeResult {
                success: Boolean!
                faceValue: Int!
                newBalance: Int!
                cardCode: String!
            }

            type RechargeCard {
                id: ID!
                code: String!
                faceValue: Int!
                state: String!
                redeemedAt: DateTime
                createdAt: DateTime!
            }

            type RechargeOrderItem {
                id: ID!
                customerId: Int!
                amount: Int!
                status: String!
                paymentMethod: String
                paidAt: DateTime
                remark: String
                createdAt: DateTime!
            }

            type BalanceTransactionItem implements Node {
                id: ID!
                customerId: Int!
                type: String!
                amount: Int!
                balanceBefore: Int!
                balanceAfter: Int!
                orderId: ID
                remark: String
                createdAt: DateTime!
            }

            type BalanceTransactionList implements PaginatedList {
                items: [BalanceTransactionItem!]!
                totalItems: Int!
            }

            type WechatRechargePaymentResult {
                rechargeOrderId: ID!
                outTradeNo: String!
                pay: WechatPayParams!
            }

            type WechatPayParams {
                payType: String!
                prepayId: String
                appId: String
                timeStamp: String
                nonceStr: String
                package: String
                signType: String
                paySign: String
                payUrl: String
            }

            input RechargeCardListOptions {
                skip: Int
                take: Int
            }

            extend type Query {
                myRechargeBalance: Int!
                myRechargeHistory: [RechargeCard!]!
                myRechargeOrders: [RechargeOrderItem!]!
                myBalanceTransactions(options: RechargeCardListOptions): BalanceTransactionList!
            }

            extend type Mutation {
                redeemRechargeCard(code: String!, pin: String): RechargeResult!
                createRechargeOrder(amount: Int!, remark: String): RechargeOrderItem!
                payRechargeOrder(id: ID!): RechargeOrderItem!
                cancelRechargeOrder(id: ID!): RechargeOrderItem!
                createWechatRechargePayment(rechargeOrderId: ID!, tradeType: String, openid: String): WechatRechargePaymentResult!
            }
        `,
            resolvers: [recharge_card_shop_resolver_1.RechargeCardShopResolver, recharge_order_resolver_1.RechargeOrderResolver],
        },
        adminApiExtensions: {
            schema: () => gql `
            type RechargeCardAdmin implements Node {
                id: ID!
                code: String!
                faceValue: Int!
                state: String!
                batchId: ID
                redeemedAt: DateTime
                expiresAt: DateTime
                createdAt: DateTime!
            }

            type RechargeCardPinOutput {
                code: String!
                pin: String!
            }

            type RechargeCardBatchAdmin implements Node {
                id: ID!
                name: String!
                prefix: String
                faceValue: Int!
                quantity: Int!
                generatedCount: Int!
                expiresAt: DateTime
                createdAt: DateTime!
                plaintextPins: [RechargeCardPinOutput!]
            }

            type RechargeCardAdminList implements PaginatedList {
                items: [RechargeCardAdmin!]!
                totalItems: Int!
            }

            type RechargeCardBatchAdminList implements PaginatedList {
                items: [RechargeCardBatchAdmin!]!
                totalItems: Int!
            }

            input CreateRechargeBatchInput {
                name: String!
                prefix: String
                faceValue: Int!
                quantity: Int!
                expiresAt: DateTime
            }

            input RechargeCardListOptions {
                skip: Int
                take: Int
                state: String
            }

            input RechargeCardBatchListOptions {
                skip: Int
                take: Int
            }

            type CustomerBalanceItem implements Node {
                id: ID!
                customerId: Int!
                channelId: Int!
                balance: Int!
                frozenBalance: Int!
            }

            type CustomerBalanceList implements PaginatedList {
                items: [CustomerBalanceItem!]!
                totalItems: Int!
            }

            type BalanceTransactionItemAdmin implements Node {
                id: ID!
                customerId: Int!
                type: String!
                amount: Int!
                balanceBefore: Int!
                balanceAfter: Int!
                orderId: ID
                paymentId: ID
                rechargeCardId: ID
                remark: String
                createdAt: DateTime!
            }

            type BalanceTransactionListAdmin implements PaginatedList {
                items: [BalanceTransactionItemAdmin!]!
                totalItems: Int!
            }

            input AdminAdjustBalanceInput {
                customerId: ID!
                amount: Int!
                type: String!
                remark: String
            }

            extend type Query {
                rechargeCards(options: RechargeCardListOptions): RechargeCardAdminList!
                rechargeCardBatches(options: RechargeCardBatchListOptions): RechargeCardBatchAdminList!
                customerBalances(options: RechargeCardListOptions): CustomerBalanceList!
                customerBalanceTransactions(customerId: ID!, options: RechargeCardListOptions): BalanceTransactionListAdmin!
            }

            extend type Mutation {
                createRechargeCardBatch(input: CreateRechargeBatchInput!): RechargeCardBatchAdmin!
                freezeRechargeCard(id: ID!): RechargeCardAdmin!
                unfreezeRechargeCard(id: ID!): RechargeCardAdmin!
                adminAdjustBalance(input: AdminAdjustBalanceInput!): CustomerBalanceItem!
            }
        `,
            resolvers: [recharge_card_admin_resolver_1.RechargeCardAdminResolver],
        },
        configuration: (config) => {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                balance_payment_handler_1.balancePaymentHandler,
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.RECHARGE_CARD_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, recharge_card_service_1.RechargeCardService,
        core_2.OrderService,
        core_1.ModuleRef])
], RechargeCardPlugin);
//# sourceMappingURL=plugin.js.map