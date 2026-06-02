import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { GROUP_BUY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { GroupBuyPluginOptions } from './types';
import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
import { GroupBuyService } from './group-buy.service';
import { GroupBuyAdminResolver } from './group-buy-admin.resolver';
import { GroupBuyShopResolver } from './group-buy-shop.resolver';
import { GroupBuyJob } from './group-buy.job';
import { groupBuyOrderCustomFields } from './order-custom-fields';
import { groupBuyDiscountCondition } from './group-buy-promotion-condition';
import { groupBuyLeaderRewardCondition } from './group-buy-leader-promotion';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [GroupBuyActivity, GroupBuyOrder],
    providers: [
        { provide: GROUP_BUY_PLUGIN_OPTIONS, useFactory: () => GroupBuyPlugin.options },
        GroupBuyService,
        GroupBuyJob,
    ],
    adminApiExtensions: {
        schema: () => gql`
            enum GroupBuyStatus { active completed expired }

            type GroupBuyActivity {
                id: ID!
                name: String!
                description: String!
                targetCount: Int!
                currentCount: Int!
                maxCount: Int!
                status: GroupBuyStatus!
                startAt: DateTime!
                endAt: DateTime!
                groupPrice: Int!
                leaderDiscount: Int!
                leaderRewardType: String!
                autoConfirm: Boolean!
                allowJoinAfterComplete: Boolean!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type GroupBuyActivityList implements PaginatedList {
                items: [GroupBuyActivity!]!
                totalItems: Int!
            }

            input CreateGroupBuyActivityInput {
                name: String!
                description: String!
                targetCount: Int!
                maxCount: Int
                startAt: DateTime!
                endAt: DateTime!
                groupPrice: Int!
                leaderDiscount: Int
                leaderRewardType: String
                autoConfirm: Boolean
                allowJoinAfterComplete: Boolean
                productId: ID!
                variantId: ID!
            }

            input UpdateGroupBuyActivityInput {
                id: ID!
                name: String
                description: String
                targetCount: Int
                maxCount: Int
                startAt: DateTime
                endAt: DateTime
                groupPrice: Int
                leaderDiscount: Int
                status: GroupBuyStatus
            }

            extend type Query {
                groupBuyActivities(options: Json): GroupBuyActivityList!
                groupBuyActivity(id: ID!): GroupBuyActivity
            }

            extend type Mutation {
                createGroupBuyActivity(input: CreateGroupBuyActivityInput!): GroupBuyActivity!
                updateGroupBuyActivity(input: UpdateGroupBuyActivityInput!): GroupBuyActivity!
                deleteGroupBuyActivity(id: ID!): Boolean!
            }
        `,
        resolvers: [GroupBuyAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            type GroupBuyOrderResult {
                id: ID!
                groupBuyActivityId: ID!
                isLeader: Boolean!
                status: String!
            }

            extend type Query {
                activeGroupBuyActivities: [GroupBuyActivity!]!
                groupBuyActivity(id: ID!): GroupBuyActivity
            }

            extend type Mutation {
                joinGroupBuy(activityId: ID!, isLeader: Boolean!): GroupBuyOrderResult!
            }
        `,
        resolvers: [GroupBuyShopResolver],
    },
    configuration: (config) => {
        config.customFields = {
            ...config.customFields,
            Order: [
                ...(config.customFields?.Order ?? []),
                ...groupBuyOrderCustomFields.Order!,
            ],
        };

        config.promotionOptions = config.promotionOptions || {};
        config.promotionOptions.promotionConditions = [
            ...(config.promotionOptions.promotionConditions ?? []),
            groupBuyDiscountCondition,
            groupBuyLeaderRewardCondition,
        ];

        return config;
    },
    compatibility: '^3.0.0',
})
export class GroupBuyPlugin implements OnApplicationBootstrap {
    private static options: GroupBuyPluginOptions = {};

    constructor(
        @Inject(GROUP_BUY_PLUGIN_OPTIONS) private options: GroupBuyPluginOptions,
        private groupBuyJob: GroupBuyJob,
    ) {}

    static init(options?: GroupBuyPluginOptions): Type<GroupBuyPlugin> {
        GroupBuyPlugin.options = options ?? {};
        return GroupBuyPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.groupBuyJob.init();
        this.groupBuyJob.scheduleCheck();
        Logger.info('GroupBuyPlugin initialized', loggerCtx);
    }
}
