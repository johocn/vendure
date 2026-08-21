import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, OrderService, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { RECHARGE_CARD_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { RechargeCardPluginOptions } from './types';
import { RechargeCard } from './recharge-card.entity';
import { RechargeCardBatch } from './recharge-card-batch.entity';
import { CustomerBalance } from './customer-balance.entity';
import { BalanceTransaction } from './balance-transaction.entity';
import { RechargeOrder } from './recharge-order.entity';
import { RechargeCardService, setWechatpayGateway } from './recharge-card.service';
import { RechargeOrderResolver } from './recharge-order.resolver';
import { balancePaymentHandler, setOrderService, setRechargeService } from './balance-payment-handler';
import { RechargeCardShopResolver } from './recharge-card-shop.resolver';
import { RechargeCardAdminResolver } from './recharge-card-admin.resolver';
import { WechatpayService, WechatpaySettlementRegistry } from '@vendure/wechatpay-plugin';

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
        resolvers: [RechargeCardShopResolver, RechargeOrderResolver],
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
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: RechargeCardPluginOptions): Type<RechargeCardPlugin> {
        RechargeCardPlugin.options = options ?? {};
        return RechargeCardPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        setRechargeService(this.rechargeCardService);
        setOrderService(this.orderService);
        // 可选接入支付网关：进程内注册了 WechatpayPlugin 时解析到，否则保持独立可用
        const injector = new Injector(this.moduleRef);
        let registry: WechatpaySettlementRegistry | null = null;
        let gateway: WechatpayService | null = null;
        try {
            gateway = injector.get(WechatpayService);
            registry = injector.get(WechatpaySettlementRegistry);
        } catch (e) {
            // 未注册网关 → 保持独立可用
        }
        setWechatpayGateway(gateway);
        if (registry) {
            const svc = this.rechargeCardService;
            registry.register({
                prefix: 'RC-',
                settle: (ctx, outTradeNo) => svc.settleRechargeOrderByOutTradeNo(ctx, outTradeNo),
            });
            Logger.info('RechargeOrder ~RC- settlement registered (wechatpay gateway)', loggerCtx);
        }
        Logger.info('RechargeCardPlugin initialized', loggerCtx);
    }
}
