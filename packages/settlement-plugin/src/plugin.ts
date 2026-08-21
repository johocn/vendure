import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    EventBus,
    OrderStateTransitionEvent,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';

import { SETTLEMENT_PLUGIN_OPTIONS, SETTLE_TRIGGER_STATES } from './constants';
import { MerchantAccount } from './merchant-account.entity';
import { SettlementEntry } from './settlement-entry.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { SettlementAdminResolver } from './settlement-admin.resolver';
import { SettlementShopResolver } from './settlement-shop.resolver';
import { SettlementService } from './settlement.service';
import { SettlementPluginOptions } from './types';

const { gql } = require('graphql-tag');

/** admin-api 共用类型（店主/平台两套 resolver 都用，schema 只需在 admin 声明一次）。 */
const settlementTypeDefs = `
    type MerchantAccount implements Node {
        id: ID!
        shopId: ID!
        commissionRate: Float!
        availableBalance: Int!
        totalGoodsAmount: Int!
        totalShippingAmount: Int!
        totalCommission: Int!
        totalWithdrawn: Int!
    }

    type SettlementEntry implements Node {
        id: ID!
        shopId: ID!
        orderId: ID!
        orderCode: String!
        goodsAmountWithTax: Int!
        shippingAmountWithTax: Int!
        commissionAmount: Int!
        netAmountWithTax: Int!
        settledAt: DateTime
    }

    type WithdrawalRequest implements Node {
        id: ID!
        shopId: ID!
        amount: Int!
        status: String!
        reviewNote: String
        paidAt: DateTime
    }

    type SettlementEntryList {
        items: [SettlementEntry!]!
        totalItems: Int!
    }

    type MerchantAccountList {
        items: [MerchantAccount!]!
        totalItems: Int!
    }

    type WithdrawalRequestList {
        items: [WithdrawalRequest!]!
        totalItems: Int!
    }

    type SettlementSummary {
        goodsAmountWithTax: Int!
        shippingAmountWithTax: Int!
        commissionAmount: Int!
        netAmountWithTax: Int!
    }

    input ListOptions {
        skip: Int
        take: Int
    }
`;

const adminSchema = () => gql`
    ${settlementTypeDefs}

    extend type Query {
        merchantAccounts(options: ListOptions): MerchantAccountList!
        settlementEntriesByShop(shopId: ID!, options: ListOptions): SettlementEntryList!
        withdrawalRequests(options: ListOptions): WithdrawalRequestList!
        myMerchantAccount: MerchantAccount!
        mySettlementEntries(options: ListOptions): SettlementEntryList!
        myWithdrawalRequests(options: ListOptions): WithdrawalRequestList!
        mySettlementSummary(from: DateTime, to: DateTime): SettlementSummary!
    }

    extend type Mutation {
        requestWithdrawal(amount: Int!): WithdrawalRequest!
        approveWithdrawal(id: ID!): WithdrawalRequest!
        payWithdrawal(id: ID!): WithdrawalRequest!
        rejectWithdrawal(id: ID!, note: String): WithdrawalRequest!
        setMerchantCommissionRate(shopId: ID!, rate: Float!): MerchantAccount!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [MerchantAccount, SettlementEntry, WithdrawalRequest],
    providers: [
        { provide: SETTLEMENT_PLUGIN_OPTIONS, useFactory: () => SettlementPlugin.options },
        SettlementService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [SettlementShopResolver, SettlementAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class SettlementPlugin implements OnApplicationBootstrap {
    private static options: SettlementPluginOptions = {};

    constructor(
        @Inject(SETTLEMENT_PLUGIN_OPTIONS) private options: SettlementPluginOptions,
        private eventBus: EventBus,
        private settlementService: SettlementService,
    ) {}

    static init(options?: SettlementPluginOptions): Type<SettlementPlugin> {
        SettlementPlugin.options = options ?? {};
        return SettlementPlugin;
    }

    onApplicationBootstrap(): void {
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe((event) => {
            if (!SETTLE_TRIGGER_STATES.includes(event.toState)) {
                return;
            }
            void this.settlementService.handleOrderSettled(event.ctx, event.order.id);
        });
    }
}