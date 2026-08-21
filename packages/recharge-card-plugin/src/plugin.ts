import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Injector, Logger, OrderService, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { RECHARGE_CARD_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { RechargeCardPluginOptions } from './types';
import { RechargeCard } from './recharge-card.entity';
import { RechargeCardBatch } from './recharge-card-batch.entity';
import { CustomerBalance } from './customer-balance.entity';
import { BalanceTransaction } from './balance-transaction.entity';
import { RechargeCardService } from './recharge-card.service';
import { balancePaymentHandler, setOrderService, setRechargeService } from './balance-payment-handler';
import { RechargeCardShopResolver } from './recharge-card-shop.resolver';
import { RechargeCardAdminResolver } from './recharge-card-admin.resolver';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [RechargeCard, RechargeCardBatch, CustomerBalance, BalanceTransaction, RechargeOrder],
    providers: [
        { provide: RECHARGE_CARD_PLUGIN_OPTIONS, useFactory: () => RechargeCardPlugin.options },
        RechargeCardService,
    ],
    shopApiExtensions: {
        schema: () => gql`
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
        resolvers: [RechargeCardShopResolver],
    },
    adminApiExtensions: {
        schema: () => gql`
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
        resolvers: [RechargeCardAdminResolver],
    },
    configuration: (config) => {
        config.paymentOptions.paymentMethodHandlers = [
            ...(config.paymentOptions.paymentMethodHandlers || []),
            balancePaymentHandler,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class RechargeCardPlugin implements OnApplicationBootstrap {
    private static options: RechargeCardPluginOptions = {};

    constructor(
        @Inject(RECHARGE_CARD_PLUGIN_OPTIONS) private options: RechargeCardPluginOptions,
        private rechargeCardService: RechargeCardService,
        private orderService: OrderService,
    ) {}

    static init(options?: RechargeCardPluginOptions): Type<RechargeCardPlugin> {
        RechargeCardPlugin.options = options ?? {};
        return RechargeCardPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        setRechargeService(this.rechargeCardService);
        setOrderService(this.orderService);
        Logger.info('RechargeCardPlugin initialized', loggerCtx);
    }
}
