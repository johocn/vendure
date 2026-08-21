import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, Logger, OrderStateTransitionEvent, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { filter } from 'rxjs/operators';

import { COMMUNITY_PLUGIN_OPTIONS, CommunityPluginOptions } from './constants';
import { CommunityAdminResolver } from './community-admin.resolver';
import { CommunityActivity } from './community-activity.entity';
import { CommunityActivityItem } from './community-activity-item.entity';
import { CommunityCommissionEntry } from './community-commission-entry.entity';
import { CommunityLeader } from './community-leader.entity';
import { CommunityParticipation } from './community-participation.entity';
import { CommunityService } from './community.service';
import { CommunityLeaderResolver } from './community-leader.resolver';

const { gql } = require('graphql-tag');

/**
 * 共享类型。admin 与 shop 两个 API 各自对独立基底 schema 做扩展，无法互相引用对方声明的类型，
 * 因此所有 plugin 类型必须在两类 schema 中各自声明一遍（对照 pickup-plugin 在 admin/shop 各自声明）。
 */
const communityTypeDefs = `
    type CommunityLeader { id: ID! userId: ID! pickupLocationId: ID! status: String! totalCommission: Int! }
    type CommunityActivity {
        id: ID! leaderId: ID! pickupLocationId: ID!
        windowStart: DateTime! windowEnd: DateTime! cutoffTime: DateTime! commissionRate: Int!
        status: String!
    }
    input CommunityActivityItemInput { variantId: ID! price: Int! stockLimit: Int }
    input CreateCommunityActivityInput {
        pickupLocationId: ID! windowStart: DateTime! windowEnd: DateTime! cutoffTime: DateTime!
        commissionRate: Int! items: [CommunityActivityItemInput!]!
    }
    type CommunityActivityList { items: [CommunityActivity!]! totalItems: Int! }
    type CommunityParticipation { id: ID! activityId: ID! orderId: ID! leaderId: ID! subtotal: Int! }
    type CommunityParticipationList { items: [CommunityParticipation!]! totalItems: Int! }
    type CommunityCommissionSummary { totalCommission: Int! }
    type CommunityCommissionEntry { id: ID! orderId: ID! leaderId: ID! amount: Int! status: String! }
    type CommunityCommissionEntryList { items: [CommunityCommissionEntry!]! totalItems: Int! }
    input CommunityListOptions { skip: Int take: Int }
`;

const adminSchema = gql`
    ${communityTypeDefs}
    extend type Mutation {
        approveLeader(id: ID!): CommunityLeader!
        suspendLeader(id: ID!): CommunityLeader!
        setActivityStatus(id: ID!, status: String!): CommunityActivity!
        participate(orderId: ID!, activityId: ID!, subtotal: Int!): CommunityParticipation!
        cutoverActivity(id: ID!): CommunityActivity!
    }
    extend type Query {
        communityActivities(options: CommunityListOptions): CommunityActivityList!
        communityParticipations(options: CommunityListOptions): CommunityParticipationList!
        communityCommissionEntries(options: CommunityListOptions): CommunityCommissionEntryList!
    }
`;

const shopSchema = gql`
    ${communityTypeDefs}
    extend type Query {
        myActivities(options: CommunityListOptions): CommunityActivityList!
        myCommission: CommunityCommissionSummary!
    }
    extend type Mutation {
        applyLeader(pickupLocationId: ID!): CommunityLeader!
        createActivity(input: CreateCommunityActivityInput!): CommunityActivity!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: COMMUNITY_PLUGIN_OPTIONS, useFactory: () => CommunityPlugin.options },
        CommunityService,
    ],
    entities: [
        CommunityLeader,
        CommunityActivity,
        CommunityActivityItem,
        CommunityParticipation,
        CommunityCommissionEntry,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [CommunityAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [CommunityLeaderResolver],
    },
})
export class CommunityPlugin implements OnApplicationBootstrap {
    private static options: CommunityPluginOptions = {};

    constructor(private service: CommunityService, private eventBus: EventBus) {}

    static init(options?: CommunityPluginOptions): typeof CommunityPlugin {
        CommunityPlugin.options = options ?? {};
        return CommunityPlugin;
    }

    onApplicationBootstrap(): void {
        // 必修点：本仓默认订单状态机只有 Delivered（无 Completed），故 filter 仅判断 Delivered。
        this.eventBus
            .ofType(OrderStateTransitionEvent)
            .pipe(filter(e => e.toState === 'Delivered'))
            .subscribe(e => {
                this.service.handleOrderStateTransition(e).catch(err =>
                    Logger.error(err?.message, 'community-plugin'),
                );
            });
    }
}