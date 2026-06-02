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

const adminSchema = gql`
    type GroupBuyActivity {
        id: ID!
        name: String!
        description: String!
        targetCount: Int!
        currentCount: Int!
        maxCount: Int!
        status: String!
        startAt: DateTime!
        endAt: DateTime!
        productId: ID!
        variantId: ID!
        groupPrice: Int!
        leaderDiscount: Int!
        leaderRewardType: String!
        rewardRules: JSON
        autoConfirm: Boolean!
        allowJoinAfterComplete: Boolean!
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
        productId: ID!
        variantId: ID!
        groupPrice: Int!
        leaderDiscount: Int
        leaderRewardType: String
        rewardRules: JSON
        autoConfirm: Boolean
        allowJoinAfterComplete: Boolean
    }

    input UpdateGroupBuyActivityInput {
        id: ID!
        name: String
        description: String
        targetCount: Int
        maxCount: Int
        status: String
        startAt: DateTime
        endAt: DateTime
        groupPrice: Int
        leaderDiscount: Int
        leaderRewardType: String
        rewardRules: JSON
        autoConfirm: Boolean
        allowJoinAfterComplete: Boolean
    }

    extend type Query {
        groupBuyActivities(options: ListQueryOptions): GroupBuyActivityList!
        groupBuyActivity(id: ID!): GroupBuyActivity
    }

    extend type Mutation {
        createGroupBuyActivity(input: CreateGroupBuyActivityInput!): GroupBuyActivity!
        updateGroupBuyActivity(input: UpdateGroupBuyActivityInput!): GroupBuyActivity!
        deleteGroupBuyActivity(id: ID!): Boolean!
    }
`;

const shopSchema = gql`
    type GroupBuyActivity {
        id: ID!
        name: String!
        description: String!
        targetCount: Int!
        currentCount: Int!
        maxCount: Int!
        status: String!
        startAt: DateTime!
        endAt: DateTime!
        productId: ID!
        variantId: ID!
        groupPrice: Int!
        leaderDiscount: Int!
        leaderRewardType: String!
        rewardRules: JSON
        autoConfirm: Boolean!
        allowJoinAfterComplete: Boolean!
    }

    type GroupBuyOrder {
        id: ID!
        groupBuyActivityId: ID!
        orderId: ID!
        isLeader: Boolean!
        status: String!
    }

    extend type Query {
        activeGroupBuyActivities(variantId: ID!): [GroupBuyActivity!]!
    }

    extend type Mutation {
        joinGroupBuy(activityId: ID!, orderId: ID!, isLeader: Boolean!): GroupBuyOrder!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [GroupBuyActivity, GroupBuyOrder],
    providers: [
        { provide: GROUP_BUY_PLUGIN_OPTIONS, useFactory: () => GroupBuyPlugin.options },
        GroupBuyService,
        GroupBuyJob,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [GroupBuyAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
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
