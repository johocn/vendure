import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    EventBus,
    Logger,
    OrderStateTransitionEvent,
    PluginCommonModule,
    RefundStateTransitionEvent,
    VendurePlugin,
} from '@vendure/core';

import { memberLevelChannelCustomFields } from './channel-custom-fields';
import { memberLevelCustomerCustomFields } from './customer-custom-fields';
import { MEMBER_LEVEL_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { memberLevelPermission } from './permissions';
import { MemberLevelPluginOptions } from './types';
import { MemberPointsHistory, PointsHistoryType } from './member-points-history.entity';
import { MemberLevelService } from './member-level.service';
import { MemberLevelAdminResolver } from './member-level-admin.resolver';
import { MemberLevelShopResolver } from './member-level-shop.resolver';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type MemberInfo {
        customerId: ID!
        level: Int!
        levelName: String!
        growthValue: Int!
        points: Int!
        nextLevelThreshold: Int
        nextLevelName: String
    }

    type MemberPointsHistory implements Node {
        id: ID!
        customerId: ID!
        type: String!
        amount: Int!
        balanceBefore: Int!
        balanceAfter: Int!
        orderId: ID
        remark: String
        expiresAt: DateTime
        createdAt: DateTime!
    }

    type PointsHistoryList implements PaginatedList {
        items: [MemberPointsHistory!]!
        totalItems: Int!
    }

    input PointsHistoryListOptions {
        skip: Int
        take: Int
    }

    type MemberListItem {
        customerId: ID!
        emailAddress: String
        firstName: String
        lastName: String
        level: Int!
        levelName: String!
        growthValue: Int!
        points: Int!
        createdAt: DateTime!
    }

    type MemberList {
        items: [MemberListItem!]!
        totalItems: Int!
    }

    type LevelConfig {
        level1Threshold: Int!
        level1Name: String!
        level2Threshold: Int!
        level2Name: String!
        level3Threshold: Int!
        level3Name: String!
        level4Threshold: Int!
        level4Name: String!
        level5Threshold: Int!
        level5Name: String!
        pointsEarnRatio: Float!
        pointsEarnOnShipping: Boolean!
    }

    input UpdateLevelConfigInput {
        level1Threshold: Int
        level1Name: String
        level2Threshold: Int
        level2Name: String
        level3Threshold: Int
        level3Name: String
        level4Threshold: Int
        level4Name: String
        level5Threshold: Int
        level5Name: String
        pointsEarnRatio: Float
        pointsEarnOnShipping: Boolean
    }

    extend type Query {
        memberInfo(customerId: ID!): MemberInfo!
        pointsHistory(customerId: ID!, options: PointsHistoryListOptions): PointsHistoryList!
        members(options: JSON): MemberList!
        levelConfig: LevelConfig!
    }

    extend type Mutation {
        adjustPoints(customerId: ID!, amount: Int!, remark: String): MemberInfo!
        adjustMemberGrowth(customerId: ID!, amount: Int!, source: String): MemberInfo!
        updateLevelConfig(input: UpdateLevelConfigInput!): LevelConfig!
    }
`;

const shopSchema = () => gql`
    type MemberInfo {
        customerId: ID!
        level: Int!
        levelName: String!
        growthValue: Int!
        points: Int!
        nextLevelThreshold: Int
        nextLevelName: String
    }

    type MemberPointsHistory implements Node {
        id: ID!
        customerId: ID!
        type: String!
        amount: Int!
        balanceBefore: Int!
        balanceAfter: Int!
        orderId: ID
        remark: String
        expiresAt: DateTime
        createdAt: DateTime!
    }

    type PointsHistoryList implements PaginatedList {
        items: [MemberPointsHistory!]!
        totalItems: Int!
    }

    input PointsHistoryListOptions {
        skip: Int
        take: Int
    }

    extend type Query {
        myMemberInfo: MemberInfo!
        myPointsHistory(options: PointsHistoryListOptions): PointsHistoryList!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [MemberPointsHistory],
    providers: [
        { provide: MEMBER_LEVEL_PLUGIN_OPTIONS, useFactory: () => MemberLevelPlugin.options },
        MemberLevelService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [MemberLevelAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [MemberLevelShopResolver],
    },
    configuration: (config) => {
        config.customFields.Channel = [
            ...(config.customFields.Channel ?? []),
            ...(memberLevelChannelCustomFields.Channel ?? []),
        ];
        config.customFields.Customer = [
            ...(config.customFields.Customer ?? []),
            ...(memberLevelCustomerCustomFields.Customer ?? []),
        ];
        config.authOptions = config.authOptions ?? {};
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            memberLevelPermission,
        ];
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class MemberLevelPlugin implements OnApplicationBootstrap {
    private static options: MemberLevelPluginOptions = {};

    constructor(
        @Inject(MEMBER_LEVEL_PLUGIN_OPTIONS) private options: MemberLevelPluginOptions,
        private memberLevelService: MemberLevelService,
        private eventBus: EventBus,
    ) {}

    static init(options?: MemberLevelPluginOptions): Type<MemberLevelPlugin> {
        MemberLevelPlugin.options = options ?? {};
        return MemberLevelPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe((event) => {
            if (event.toState !== 'Delivered') return;
            void this.handleOrderDelivered(event);
        });

        this.eventBus.ofType(RefundStateTransitionEvent).subscribe((event) => {
            if (event.toState !== 'Settled') return;
            void this.handleRefundSettled(event);
        });

        Logger.info('MemberLevelPlugin initialized', loggerCtx);
    }

    private async handleOrderDelivered(event: OrderStateTransitionEvent): Promise<void> {
        const { ctx, order } = event;
        if (!order.customer) return;
        const customerId = order.customer.id;
        try {
            const cf = (ctx.channel as any).customFields ?? {};
            const ratio = cf.pointsEarnRatio ?? this.options.defaultPointsEarnRatio ?? 1;
            const earnOnShipping =
                cf.pointsEarnOnShipping ?? this.options.defaultPointsEarnOnShipping ?? false;
            const base = earnOnShipping ? order.total ?? 0 : order.subTotal ?? 0;
            const points = Math.floor(base * ratio);
            if (points <= 0) return;

            const alreadyCredited = await this.memberLevelService.hasPointsRecord(
                ctx,
                customerId,
                order.id,
                PointsHistoryType.EARN,
            );
            if (alreadyCredited) {
                Logger.warn(`Order ${order.id} already credited points, skipping`, loggerCtx);
                return;
            }

            await this.memberLevelService.addGrowthValue(
                ctx,
                customerId,
                Math.floor(base),
                'order_delivered',
            );
            await this.memberLevelService.addPoints(
                ctx,
                customerId,
                points,
                order.id,
                'order_delivered',
            );
            Logger.info(
                `Order ${order.id} delivered: +${Math.floor(base)} growth, +${points} points for customer ${customerId}`,
                loggerCtx,
            );
        } catch (e: any) {
            Logger.error(
                `Failed to credit points for order ${order.id}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }

    private async handleRefundSettled(event: RefundStateTransitionEvent): Promise<void> {
        const { ctx, order, refund } = event;
        if (!order.customer) return;
        const customerId = order.customer.id;
        try {
            const cf = (ctx.channel as any).customFields ?? {};
            const ratio = cf.pointsEarnRatio ?? this.options.defaultPointsEarnRatio ?? 1;
            const refundAmount = refund.total ?? 0;
            const pointsToDeduct = Math.floor(refundAmount * ratio);
            if (pointsToDeduct <= 0) return;

            await this.memberLevelService.spendPoints(
                ctx,
                customerId,
                pointsToDeduct,
                order.id,
                `refund_settled:${refund.id}`,
            );
            await this.memberLevelService.addGrowthValue(
                ctx,
                customerId,
                -Math.floor(refundAmount),
                'refund_settled',
            );
            Logger.info(
                `Refund ${refund.id} settled for order ${order.id}: -${Math.floor(refundAmount)} growth, -${pointsToDeduct} points for customer ${customerId}`,
                loggerCtx,
            );
        } catch (e: any) {
            Logger.error(
                `Failed to deduct points for refund on order ${order.id}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }
}
