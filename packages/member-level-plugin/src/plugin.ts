import { Global, Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
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
import { memberLevelOrderCustomFields } from './order-custom-fields';
import { pointsRedeemCondition } from './points-redeem-condition';
import { pointsRedeemAction } from './points-redeem-action';
import { pointsExpireTask } from './points-expire.job';
import { MEMBER_LEVEL_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { memberLevelPermission } from './permissions';
import { MemberLevelPluginOptions } from './types';
import { MemberPointsHistory, PointsHistoryType } from './member-points-history.entity';
import { MemberTier } from './member-tier.entity';
import { MemberLevelService } from './member-level.service';
import { tierEligibleCondition } from './tier-discount-condition';
import { tierDiscountAction } from './tier-discount-action';
import { tierFreeShippingCalculator, tierFreeShippingEligibilityChecker } from './tier-free-shipping';
import { MemberLevelAdminResolver } from './member-level-admin.resolver';
import { MemberLevelShopResolver } from './member-level-shop.resolver';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

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
        pointsMultiplier: Int!
        redeemDiscountRate: Int!
        redeemCapRatio: Int!
        specialDiscountRate: Int!
    }

    type MemberTier {
        id: ID!
        tierLevel: Int!
        threshold: Int!
        name: String!
        pointsMultiplier: Int!
        redeemDiscountRate: Int!
        redeemCapRatio: Int!
        specialDiscountRate: Int!
    }

    input MemberTierInput {
        tierLevel: Int!
        threshold: Int!
        name: String!
        pointsMultiplier: Int
        redeemDiscountRate: Int
        redeemCapRatio: Int
        specialDiscountRate: Int
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
        memberTiers: [MemberTier!]!
    }

    extend type Mutation {
        adjustPoints(customerId: ID!, amount: Int!, remark: String): MemberInfo!
        adjustMemberGrowth(customerId: ID!, amount: Int!, source: String): MemberInfo!
        updateLevelConfig(input: UpdateLevelConfigInput!): LevelConfig!
        saveTiers(input: [MemberTierInput!]!): [MemberTier!]!
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
        pointsMultiplier: Int!
        redeemDiscountRate: Int!
        redeemCapRatio: Int!
        specialDiscountRate: Int!
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
        myTier: MemberInfo!
        myPointsHistory(options: PointsHistoryListOptions): PointsHistoryList!
    }

    extend type Mutation {
        redeemPoints(points: Int!): Order!
    }
`;

@Global()
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [MemberPointsHistory, MemberTier],
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
        config.customFields.Channel = mergeCustomFields(config.customFields.Channel, memberLevelChannelCustomFields.Channel);
        config.customFields.Customer = mergeCustomFields(config.customFields.Customer, memberLevelCustomerCustomFields.Customer);
        config.customFields.Order = mergeCustomFields(config.customFields.Order, memberLevelOrderCustomFields.Order);
        config.promotionOptions = config.promotionOptions ?? {};
        config.promotionOptions.promotionConditions = [
            ...(config.promotionOptions.promotionConditions ?? []),
            pointsRedeemCondition,
            tierEligibleCondition,
        ];
        config.promotionOptions.promotionActions = [
            ...(config.promotionOptions.promotionActions ?? []),
            pointsRedeemAction,
            tierDiscountAction,
        ];
        config.shippingOptions = config.shippingOptions ?? {};
        config.shippingOptions.shippingEligibilityCheckers = [
            ...(config.shippingOptions.shippingEligibilityCheckers ?? []),
            tierFreeShippingEligibilityChecker,
        ];
        config.shippingOptions.shippingCalculators = [
            ...(config.shippingOptions.shippingCalculators ?? []),
            tierFreeShippingCalculator,
        ];
        config.schedulerOptions = config.schedulerOptions ?? {};
        config.schedulerOptions.tasks = config.schedulerOptions.tasks ?? [];
        if (!config.schedulerOptions.tasks.some(t => t.id === pointsExpireTask.id)) {
            config.schedulerOptions.tasks.push(pointsExpireTask);
        }
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
            if (event.toState === 'Delivered') {
                void this.handleOrderDelivered(event);
            } else if (event.toState === 'Cancelled') {
                void this.handleOrderCancelled(event);
            }
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
            const earnOnShipping =
                cf.pointsEarnOnShipping ?? this.options.defaultPointsEarnOnShipping ?? false;
            const base = earnOnShipping ? order.total ?? 0 : order.subTotal ?? 0;
            // 设计4.2：积分获取倍率以当前会员档位 pointsMultiplier 为准（千分比，1000=×1），取代 channel pointsEarnRatio
            const tier = await this.memberLevelService.resolveTierForCustomer(ctx, customerId);
            const ratio = (tier.pointsMultiplier ?? 1000) / 1000;
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
            // 积分有效期：Channel.pointsExpireDays 配置后写入 expiresAt（过期清理任务据此扫描）
            const expireDays = cf.pointsExpireDays ?? this.options.defaultPointsExpireDays ?? 0;
            const expiresAt = expireDays > 0 ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000) : null;
            await this.memberLevelService.addPoints(
                ctx,
                customerId,
                points,
                order.id,
                'order_delivered',
                expiresAt,
            );
            Logger.info(
                `Order ${order.id} delivered: +${Math.floor(base)} growth, +${points} points (expires ${expiresAt?.toISOString() ?? 'never'}) for customer ${customerId}`,
                loggerCtx,
            );
        } catch (e: any) {
            Logger.error(
                `Failed to credit points for order ${order.id}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }

    /**
     * 订单取消 → 回退已抵扣积分（若该订单曾 redeemPoints 且未回退）+ 清空订单字段。
     */
    private async handleOrderCancelled(event: OrderStateTransitionEvent): Promise<void> {
        const { ctx, order } = event;
        if (!order.customer) return;
        try {
            const pointsToRedeem = (order as any)?.customFields?.pointsToRedeem ?? 0;
            if (pointsToRedeem <= 0) return;
            await this.memberLevelService.releasePointsByOrder(ctx, order);
        } catch (e: any) {
            Logger.error(
                `Failed to release points for cancelled order ${order.id}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }

    private async handleRefundSettled(event: RefundStateTransitionEvent): Promise<void> {
        const { ctx, order, refund } = event;
        // 注意：Refund 事件携带的 order 不保证加载了 customer 关系，
        // 归属与 pointsToRedeem 由 refundPointsByOrder 内部按 id 重载，勿在此拦截 order.customer。
        try {
            // 退款按比例回退该订单已抵扣的积分（只回退、不额外扣分，避免双重记账）
            await this.memberLevelService.refundPointsByOrder(ctx, order, refund);
        } catch (e: any) {
            Logger.error(
                `Failed to refund points for order ${order.id}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }
}
