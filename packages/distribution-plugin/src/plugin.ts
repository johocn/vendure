import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { DISTRIBUTION_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { DistributionAdminResolver } from './distribution-admin.resolver';
import { DistributionAdminShopResolver } from './distribution-admin-shop.resolver';
import { DistributionService } from './distribution.service';
import { DistributionShopResolver } from './distribution-shop.resolver';
import { Distributor } from './distributor.entity';
import { DistributionPluginOptions } from './types';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';
import { distributionChannelCustomFields } from './channel-custom-fields';
import { distributionCustomerCustomFields } from './customer-custom-fields';
import { settleCommissionsTask } from './commission.job';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Distributor, CommissionRecord, WithdrawalRequest],
    providers: [
        { provide: DISTRIBUTION_PLUGIN_OPTIONS, useFactory: () => DistributionPlugin.options },
        DistributionService,
        CommissionService,
        WithdrawalService,
    ],
    adminApiExtensions: {
        schema: () => gql`
            enum DistributorStatus { active frozen pending }
            enum CommissionType { direct indirect }
            enum CommissionStatus { pending confirmed paid cancelled }
            enum WithdrawalMethod { bank alipay wechat }
            enum WithdrawalStatus { pending approved rejected paid }

            type Distributor implements Node {
                id: ID!
                customerId: ID!
                parentId: ID
                level: Int!
                status: DistributorStatus!
                totalEarnings: Int!
                availableBalance: Int!
                frozenBalance: Int!
                referralCode: String!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type CommissionRecord implements Node {
                id: ID!
                distributorId: ID!
                orderId: ID!
                commissionType: CommissionType!
                commissionRate: Int!
                orderAmount: Int!
                commissionAmount: Int!
                status: CommissionStatus!
                settledAt: DateTime
                createdAt: DateTime!
            }

            type WithdrawalRequest implements Node {
                id: ID!
                distributorId: ID!
                amount: Int!
                method: WithdrawalMethod!
                accountInfo: String!
                status: WithdrawalStatus!
                reviewedAt: DateTime
                paidAt: DateTime
                createdAt: DateTime!
            }

            type DistributorList implements PaginatedList {
                items: [Distributor!]!
                totalItems: Int!
            }

            type CommissionRecordList implements PaginatedList {
                items: [CommissionRecord!]!
                totalItems: Int!
            }

            type WithdrawalRequestList implements PaginatedList {
                items: [WithdrawalRequest!]!
                totalItems: Int!
            }

            input DistributorListOptions
            input CommissionRecordListOptions
            input WithdrawalRequestListOptions

            extend type Query {
                distributors(options: DistributorListOptions): DistributorList!
                commissionRecords(options: CommissionRecordListOptions): CommissionRecordList!
                withdrawalRequests(options: WithdrawalRequestListOptions): WithdrawalRequestList!
            }

            extend type Mutation {
                approveDistributor(id: ID!): Distributor!
                freezeDistributor(id: ID!): Distributor!
                approveWithdrawal(id: ID!): WithdrawalRequest!
                rejectWithdrawal(id: ID!): WithdrawalRequest!
                markWithdrawalPaid(id: ID!): WithdrawalRequest!
            }
        `,
        resolvers: [DistributionAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            enum DistributorStatus { active frozen pending }
            enum CommissionType { direct indirect }
            enum CommissionStatus { pending confirmed paid cancelled }
            enum WithdrawalMethod { bank alipay wechat }
            enum WithdrawalStatus { pending approved rejected paid }

            type Distributor implements Node {
                id: ID!
                customerId: ID!
                customerEmail: String
                parentId: ID
                level: Int!
                status: DistributorStatus!
                totalEarnings: Int!
                availableBalance: Int!
                frozenBalance: Int!
                referralCode: String!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type CommissionRecord implements Node {
                id: ID!
                distributorId: ID!
                orderId: ID!
                orderLineId: ID
                fromDistributorId: ID
                commissionType: CommissionType!
                commissionRate: Int!
                orderAmount: Int!
                commissionAmount: Int!
                status: CommissionStatus!
                settledAt: DateTime
                createdAt: DateTime!
            }

            type WithdrawalRequest implements Node {
                id: ID!
                distributorId: ID!
                amount: Int!
                method: WithdrawalMethod!
                accountInfo: String!
                status: WithdrawalStatus!
                reviewedAt: DateTime
                paidAt: DateTime
                createdAt: DateTime!
            }

            type DistributorList implements PaginatedList {
                items: [Distributor!]!
                totalItems: Int!
            }

            type CommissionRecordList implements PaginatedList {
                items: [CommissionRecord!]!
                totalItems: Int!
            }

            type WithdrawalRequestList implements PaginatedList {
                items: [WithdrawalRequest!]!
                totalItems: Int!
            }

            input DistributorListOptions
            input CommissionRecordListOptions
            input WithdrawalRequestListOptions

            extend type Query {
                myDistributorProfile: Distributor
                myCommissionRecords(options: CommissionRecordListOptions): CommissionRecordList!
                myWithdrawalRequests(options: WithdrawalRequestListOptions): WithdrawalRequestList!
                distributors(options: DistributorListOptions): DistributorList!
                commissionRecords(options: CommissionRecordListOptions): CommissionRecordList!
                withdrawalRequests(options: WithdrawalRequestListOptions): WithdrawalRequestList!
            }

            extend type Mutation {
                applyDistributor(referredByCode: String): Distributor!
                requestWithdrawal(amount: Int!, method: WithdrawalMethod!, accountInfo: String!): WithdrawalRequest!
                approveDistributor(id: ID!): Distributor!
                freezeDistributor(id: ID!): Distributor!
                approveWithdrawal(id: ID!): WithdrawalRequest!
                rejectWithdrawal(id: ID!): WithdrawalRequest!
                markWithdrawalPaid(id: ID!): WithdrawalRequest!
                settleCommissionsNow: Int!
            }
        `,
        resolvers: [DistributionShopResolver, DistributionAdminShopResolver],
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
        // 注册每日佣金结算 ScheduledTask（由 DefaultSchedulerPlugin 在 worker 上周期执行）
        if (!config.schedulerOptions) {
            config.schedulerOptions = { tasks: [] } as any;
        }
        if (!config.schedulerOptions.tasks) {
            config.schedulerOptions.tasks = [];
        }
        config.schedulerOptions.tasks.push(settleCommissionsTask);
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class DistributionPlugin implements OnApplicationBootstrap {
    private static options: DistributionPluginOptions = {};

    constructor(
        @Inject(DISTRIBUTION_PLUGIN_OPTIONS) private options: DistributionPluginOptions,
        private commissionService: CommissionService,
    ) {}

    static init(options?: DistributionPluginOptions): Type<DistributionPlugin> {
        DistributionPlugin.options = options ?? {};
        return DistributionPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.commissionService.init();
        Logger.info('DistributionPlugin initialized', loggerCtx);
    }
}
