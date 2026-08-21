"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MemberLevelPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberLevelPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const channel_custom_fields_1 = require("./channel-custom-fields");
const customer_custom_fields_1 = require("./customer-custom-fields");
const order_custom_fields_1 = require("./order-custom-fields");
const points_redeem_condition_1 = require("./points-redeem-condition");
const points_redeem_action_1 = require("./points-redeem-action");
const points_expire_job_1 = require("./points-expire.job");
const constants_1 = require("./constants");
const permissions_1 = require("./permissions");
const member_points_history_entity_1 = require("./member-points-history.entity");
const member_tier_entity_1 = require("./member-tier.entity");
const member_level_service_1 = require("./member-level.service");
const tier_discount_condition_1 = require("./tier-discount-condition");
const tier_discount_action_1 = require("./tier-discount-action");
const tier_free_shipping_1 = require("./tier-free-shipping");
const member_level_admin_resolver_1 = require("./member-level-admin.resolver");
const member_level_shop_resolver_1 = require("./member-level-shop.resolver");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
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
const shopSchema = () => gql `
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
let MemberLevelPlugin = MemberLevelPlugin_1 = class MemberLevelPlugin {
    constructor(options, memberLevelService, eventBus) {
        this.options = options;
        this.memberLevelService = memberLevelService;
        this.eventBus = eventBus;
    }
    static init(options) {
        MemberLevelPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return MemberLevelPlugin_1;
    }
    async onApplicationBootstrap() {
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe((event) => {
            if (event.toState === 'Delivered') {
                void this.handleOrderDelivered(event);
            }
            else if (event.toState === 'Cancelled') {
                void this.handleOrderCancelled(event);
            }
        });
        this.eventBus.ofType(core_1.RefundStateTransitionEvent).subscribe((event) => {
            if (event.toState !== 'Settled')
                return;
            void this.handleRefundSettled(event);
        });
        core_1.Logger.info('MemberLevelPlugin initialized', constants_1.loggerCtx);
    }
    async handleOrderDelivered(event) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const { ctx, order } = event;
        if (!order.customer)
            return;
        const customerId = order.customer.id;
        try {
            const cf = (_a = ctx.channel.customFields) !== null && _a !== void 0 ? _a : {};
            const earnOnShipping = (_c = (_b = cf.pointsEarnOnShipping) !== null && _b !== void 0 ? _b : this.options.defaultPointsEarnOnShipping) !== null && _c !== void 0 ? _c : false;
            const base = earnOnShipping ? (_d = order.total) !== null && _d !== void 0 ? _d : 0 : (_e = order.subTotal) !== null && _e !== void 0 ? _e : 0;
            // 设计4.2：积分获取倍率以当前会员档位 pointsMultiplier 为准（千分比，1000=×1），取代 channel pointsEarnRatio
            const tier = await this.memberLevelService.resolveTierForCustomer(ctx, customerId);
            const ratio = ((_f = tier.pointsMultiplier) !== null && _f !== void 0 ? _f : 1000) / 1000;
            const points = Math.floor(base * ratio);
            if (points <= 0)
                return;
            const alreadyCredited = await this.memberLevelService.hasPointsRecord(ctx, customerId, order.id, member_points_history_entity_1.PointsHistoryType.EARN);
            if (alreadyCredited) {
                core_1.Logger.warn(`Order ${order.id} already credited points, skipping`, constants_1.loggerCtx);
                return;
            }
            await this.memberLevelService.addGrowthValue(ctx, customerId, Math.floor(base), 'order_delivered');
            // 积分有效期：Channel.pointsExpireDays 配置后写入 expiresAt（过期清理任务据此扫描）
            const expireDays = (_h = (_g = cf.pointsExpireDays) !== null && _g !== void 0 ? _g : this.options.defaultPointsExpireDays) !== null && _h !== void 0 ? _h : 0;
            const expiresAt = expireDays > 0 ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000) : null;
            await this.memberLevelService.addPoints(ctx, customerId, points, order.id, 'order_delivered', expiresAt);
            core_1.Logger.info(`Order ${order.id} delivered: +${Math.floor(base)} growth, +${points} points (expires ${(_j = expiresAt === null || expiresAt === void 0 ? void 0 : expiresAt.toISOString()) !== null && _j !== void 0 ? _j : 'never'}) for customer ${customerId}`, constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.error(`Failed to credit points for order ${order.id}: ${(_k = e === null || e === void 0 ? void 0 : e.message) !== null && _k !== void 0 ? _k : e}`, constants_1.loggerCtx);
        }
    }
    /**
     * 订单取消 → 回退已抵扣积分（若该订单曾 redeemPoints 且未回退）+ 清空订单字段。
     */
    async handleOrderCancelled(event) {
        var _a, _b, _c;
        const { ctx, order } = event;
        if (!order.customer)
            return;
        try {
            const pointsToRedeem = (_b = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.pointsToRedeem) !== null && _b !== void 0 ? _b : 0;
            if (pointsToRedeem <= 0)
                return;
            await this.memberLevelService.releasePointsByOrder(ctx, order);
        }
        catch (e) {
            core_1.Logger.error(`Failed to release points for cancelled order ${order.id}: ${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, constants_1.loggerCtx);
        }
    }
    async handleRefundSettled(event) {
        var _a;
        const { ctx, order, refund } = event;
        // 注意：Refund 事件携带的 order 不保证加载了 customer 关系，
        // 归属与 pointsToRedeem 由 refundPointsByOrder 内部按 id 重载，勿在此拦截 order.customer。
        try {
            // 退款按比例回退该订单已抵扣的积分（只回退、不额外扣分，避免双重记账）
            await this.memberLevelService.refundPointsByOrder(ctx, order, refund);
        }
        catch (e) {
            core_1.Logger.error(`Failed to refund points for order ${order.id}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    }
};
exports.MemberLevelPlugin = MemberLevelPlugin;
MemberLevelPlugin.options = {};
exports.MemberLevelPlugin = MemberLevelPlugin = MemberLevelPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [member_points_history_entity_1.MemberPointsHistory, member_tier_entity_1.MemberTier],
        providers: [
            { provide: constants_1.MEMBER_LEVEL_PLUGIN_OPTIONS, useFactory: () => MemberLevelPlugin.options },
            member_level_service_1.MemberLevelService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [member_level_admin_resolver_1.MemberLevelAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [member_level_shop_resolver_1.MemberLevelShopResolver],
        },
        configuration: (config) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            config.customFields.Channel = mergeCustomFields(config.customFields.Channel, channel_custom_fields_1.memberLevelChannelCustomFields.Channel);
            config.customFields.Customer = mergeCustomFields(config.customFields.Customer, customer_custom_fields_1.memberLevelCustomerCustomFields.Customer);
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.memberLevelOrderCustomFields.Order);
            config.promotionOptions = (_a = config.promotionOptions) !== null && _a !== void 0 ? _a : {};
            config.promotionOptions.promotionConditions = [
                ...((_b = config.promotionOptions.promotionConditions) !== null && _b !== void 0 ? _b : []),
                points_redeem_condition_1.pointsRedeemCondition,
                tier_discount_condition_1.tierEligibleCondition,
            ];
            config.promotionOptions.promotionActions = [
                ...((_c = config.promotionOptions.promotionActions) !== null && _c !== void 0 ? _c : []),
                points_redeem_action_1.pointsRedeemAction,
                tier_discount_action_1.tierDiscountAction,
            ];
            config.shippingOptions = (_d = config.shippingOptions) !== null && _d !== void 0 ? _d : {};
            config.shippingOptions.shippingEligibilityCheckers = [
                ...((_e = config.shippingOptions.shippingEligibilityCheckers) !== null && _e !== void 0 ? _e : []),
                tier_free_shipping_1.tierFreeShippingEligibilityChecker,
            ];
            config.shippingOptions.shippingCalculators = [
                ...((_f = config.shippingOptions.shippingCalculators) !== null && _f !== void 0 ? _f : []),
                tier_free_shipping_1.tierFreeShippingCalculator,
            ];
            config.schedulerOptions = (_g = config.schedulerOptions) !== null && _g !== void 0 ? _g : {};
            config.schedulerOptions.tasks = (_h = config.schedulerOptions.tasks) !== null && _h !== void 0 ? _h : [];
            if (!config.schedulerOptions.tasks.some(t => t.id === points_expire_job_1.pointsExpireTask.id)) {
                config.schedulerOptions.tasks.push(points_expire_job_1.pointsExpireTask);
            }
            config.authOptions = (_j = config.authOptions) !== null && _j !== void 0 ? _j : {};
            config.authOptions.customPermissions = [
                ...((_k = config.authOptions.customPermissions) !== null && _k !== void 0 ? _k : []),
                permissions_1.memberLevelPermission,
            ];
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.MEMBER_LEVEL_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, member_level_service_1.MemberLevelService,
        core_1.EventBus])
], MemberLevelPlugin);
//# sourceMappingURL=plugin.js.map