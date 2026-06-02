import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ChannelService, Logger, PluginCommonModule, RequestContext, VendurePlugin } from '@vendure/core';

import { DISTRIBUTION_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CommissionJob } from './commission.job';
import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { DistributionAdminResolver } from './distribution-admin.resolver';
import { DistributionService } from './distribution.service';
import { DistributionShopResolver } from './distribution-shop.resolver';
import { Distributor } from './distributor.entity';
import { DistributionPluginOptions } from './types';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';
import { distributionChannelCustomFields } from './channel-custom-fields';
import { distributionCustomerCustomFields } from './customer-custom-fields';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Distributor, CommissionRecord, WithdrawalRequest],
    providers: [
        { provide: DISTRIBUTION_PLUGIN_OPTIONS, useFactory: () => DistributionPlugin.options },
        DistributionService,
        CommissionService,
        WithdrawalService,
        CommissionJob,
    ],
    adminApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                type Distributor {
                    id: ID!
                    customerId: ID!
                    parentId: ID
                    level: Int!
                    status: String!
                    totalEarnings: Int!
                    availableBalance: Int!
                    frozenBalance: Int!
                    referralCode: String!
                    createdAt: DateTime!
                    updatedAt: DateTime!
                }

                type DistributorList implements PaginatedList {
                    items: [Distributor!]!
                    totalItems: Int!
                }

                type CommissionRecord {
                    id: ID!
                    distributorId: ID!
                    orderId: ID!
                    orderLineId: ID
                    fromDistributorId: ID
                    commissionType: String!
                    commissionRate: Int!
                    orderAmount: Int!
                    commissionAmount: Int!
                    status: String!
                    settledAt: DateTime
                    createdAt: DateTime!
                    updatedAt: DateTime!
                }

                type CommissionRecordList implements PaginatedList {
                    items: [CommissionRecord!]!
                    totalItems: Int!
                }

                type WithdrawalRequest {
                    id: ID!
                    distributorId: ID!
                    amount: Int!
                    method: String!
                    accountInfo: String!
                    status: String!
                    reviewedAt: DateTime
                    paidAt: DateTime
                    createdAt: DateTime!
                    updatedAt: DateTime!
                }

                type WithdrawalRequestList implements PaginatedList {
                    items: [WithdrawalRequest!]!
                    totalItems: Int!
                }

                extend type Query {
                    distributors(options: ListQueryOptions): DistributorList!
                    commissionRecords(options: ListQueryOptions): CommissionRecordList!
                    withdrawalRequests(options: ListQueryOptions): WithdrawalRequestList!
                }

                extend type Mutation {
                    approveDistributor(id: ID!): Distributor!
                    freezeDistributor(id: ID!): Distributor!
                    approveWithdrawal(id: ID!): WithdrawalRequest!
                    rejectWithdrawal(id: ID!): WithdrawalRequest!
                    markWithdrawalPaid(id: ID!): WithdrawalRequest!
                }
            `;
        },
        resolvers: [DistributionAdminResolver],
    },
    shopApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                type Distributor {
                    id: ID!
                    customerId: ID!
                    parentId: ID
                    level: Int!
                    status: String!
                    totalEarnings: Int!
                    availableBalance: Int!
                    frozenBalance: Int!
                    referralCode: String!
                    createdAt: DateTime!
                    updatedAt: DateTime!
                }

                type CommissionRecord {
                    id: ID!
                    distributorId: ID!
                    orderId: ID!
                    orderLineId: ID
                    fromDistributorId: ID
                    commissionType: String!
                    commissionRate: Int!
                    orderAmount: Int!
                    commissionAmount: Int!
                    status: String!
                    settledAt: DateTime
                    createdAt: DateTime!
                    updatedAt: DateTime!
                }

                type CommissionRecordList implements PaginatedList {
                    items: [CommissionRecord!]!
                    totalItems: Int!
                }

                type WithdrawalRequest {
                    id: ID!
                    distributorId: ID!
                    amount: Int!
                    method: String!
                    accountInfo: String!
                    status: String!
                    reviewedAt: DateTime
                    paidAt: DateTime
                    createdAt: DateTime!
                    updatedAt: DateTime!
                }

                type WithdrawalRequestList implements PaginatedList {
                    items: [WithdrawalRequest!]!
                    totalItems: Int!
                }

                extend type Query {
                    myDistributorProfile: Distributor
                    myCommissionRecords(options: ListQueryOptions): CommissionRecordList!
                    myWithdrawalRequests(options: ListQueryOptions): WithdrawalRequestList!
                }

                extend type Mutation {
                    applyDistributor(referredByCode: String): Distributor!
                    requestWithdrawal(amount: Int!, method: String!, accountInfo: String!): WithdrawalRequest!
                }
            `;
        },
        resolvers: [DistributionShopResolver],
    },
    configuration: config => {
        config.customFields = {
            ...config.customFields,
            Channel: [
                ...(config.customFields?.Channel ?? []),
                ...distributionChannelCustomFields.Channel!,
            ],
            Customer: [
                ...(config.customFields?.Customer ?? []),
                ...distributionCustomerCustomFields.Customer!,
            ],
        };
        return config;
    },
    compatibility: '^3.0.0',
})
export class DistributionPlugin implements OnApplicationBootstrap {
    private static options: DistributionPluginOptions = {};

    constructor(
        @Inject(DISTRIBUTION_PLUGIN_OPTIONS) private options: DistributionPluginOptions,
        private commissionService: CommissionService,
        private commissionJob: CommissionJob,
        private channelService: ChannelService,
    ) {}

    static init(options?: DistributionPluginOptions): Type<DistributionPlugin> {
        DistributionPlugin.options = options ?? {};
        return DistributionPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.commissionService.init();
        await this.commissionJob.init();

        const emptyCtx = RequestContext.empty();
        const channels = await this.channelService.findAll(emptyCtx);

        for (const channel of channels.items) {
            if ((channel as any).customFields?.distributionEnabled) {
                await this.commissionJob.scheduleSettlement(channel.id as string);
                Logger.info(`Scheduled commission settlement for channel ${channel.id}`, loggerCtx);
            }
        }

        Logger.info('DistributionPlugin initialized', loggerCtx);
    }
}
