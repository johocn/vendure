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
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const recharge_card_entity_1 = require("./recharge-card.entity");
const recharge_card_batch_entity_1 = require("./recharge-card-batch.entity");
const customer_balance_entity_1 = require("./customer-balance.entity");
const balance_transaction_entity_1 = require("./balance-transaction.entity");
const recharge_card_service_1 = require("./recharge-card.service");
const balance_payment_handler_1 = require("./balance-payment-handler");
const recharge_card_shop_resolver_1 = require("./recharge-card-shop.resolver");
const recharge_card_admin_resolver_1 = require("./recharge-card-admin.resolver");
const { gql } = require('graphql-tag');
let RechargeCardPlugin = RechargeCardPlugin_1 = class RechargeCardPlugin {
    constructor(options, rechargeCardService, orderService) {
        this.options = options;
        this.rechargeCardService = rechargeCardService;
        this.orderService = orderService;
    }
    static init(options) {
        RechargeCardPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return RechargeCardPlugin_1;
    }
    async onApplicationBootstrap() {
        (0, balance_payment_handler_1.setRechargeService)(this.rechargeCardService);
        (0, balance_payment_handler_1.setOrderService)(this.orderService);
        core_1.Logger.info('RechargeCardPlugin initialized', constants_1.loggerCtx);
    }
};
exports.RechargeCardPlugin = RechargeCardPlugin;
RechargeCardPlugin.options = {};
exports.RechargeCardPlugin = RechargeCardPlugin = RechargeCardPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [recharge_card_entity_1.RechargeCard, recharge_card_batch_entity_1.RechargeCardBatch, customer_balance_entity_1.CustomerBalance, balance_transaction_entity_1.BalanceTransaction],
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

            extend type Query {
                myRechargeBalance: Int!
                myRechargeHistory: [RechargeCard!]!
            }

            extend type Mutation {
                redeemRechargeCard(code: String!, pin: String): RechargeResult!
            }
        `,
            resolvers: [recharge_card_shop_resolver_1.RechargeCardShopResolver],
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

            type RechargeCardBatchAdmin implements Node {
                id: ID!
                name: String!
                prefix: String
                faceValue: Int!
                quantity: Int!
                generatedCount: Int!
                expiresAt: DateTime
                createdAt: DateTime!
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

            extend type Query {
                rechargeCards(options: RechargeCardListOptions): RechargeCardAdminList!
                rechargeCardBatches(options: RechargeCardBatchListOptions): RechargeCardBatchAdminList!
            }

            extend type Mutation {
                createRechargeCardBatch(input: CreateRechargeBatchInput!): RechargeCardBatchAdmin!
                freezeRechargeCard(id: ID!): RechargeCardAdmin!
                unfreezeRechargeCard(id: ID!): RechargeCardAdmin!
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
        core_1.OrderService])
], RechargeCardPlugin);
//# sourceMappingURL=plugin.js.map