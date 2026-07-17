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
const constants_1 = require("./constants");
const member_points_history_entity_1 = require("./member-points-history.entity");
const member_level_service_1 = require("./member-level.service");
const member_level_admin_resolver_1 = require("./member-level-admin.resolver");
const member_level_shop_resolver_1 = require("./member-level-shop.resolver");
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
        memberInfo(customerId: ID!): MemberInfo!
        pointsHistory(customerId: ID!, options: PointsHistoryListOptions): PointsHistoryList!
    }

    extend type Mutation {
        adjustPoints(customerId: ID!, amount: Int!, remark: String): MemberInfo!
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
            if (event.toState !== 'Delivered')
                return;
            void this.handleOrderDelivered(event);
        });
        this.eventBus.ofType(core_1.RefundStateTransitionEvent).subscribe((event) => {
            if (event.toState !== 'Settled')
                return;
            void this.handleRefundSettled(event);
        });
        core_1.Logger.info('MemberLevelPlugin initialized', constants_1.loggerCtx);
    }
    async handleOrderDelivered(event) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const { ctx, order } = event;
        if (!order.customer)
            return;
        const customerId = order.customer.id;
        try {
            const cf = (_a = ctx.channel.customFields) !== null && _a !== void 0 ? _a : {};
            const ratio = (_c = (_b = cf.pointsEarnRatio) !== null && _b !== void 0 ? _b : this.options.defaultPointsEarnRatio) !== null && _c !== void 0 ? _c : 1;
            const earnOnShipping = (_e = (_d = cf.pointsEarnOnShipping) !== null && _d !== void 0 ? _d : this.options.defaultPointsEarnOnShipping) !== null && _e !== void 0 ? _e : false;
            const base = earnOnShipping ? (_f = order.total) !== null && _f !== void 0 ? _f : 0 : (_g = order.subTotal) !== null && _g !== void 0 ? _g : 0;
            const points = Math.floor(base * ratio);
            if (points <= 0)
                return;
            const alreadyCredited = await this.memberLevelService.hasPointsRecord(ctx, customerId, order.id, member_points_history_entity_1.PointsHistoryType.EARN);
            if (alreadyCredited) {
                core_1.Logger.warn(`Order ${order.id} already credited points, skipping`, constants_1.loggerCtx);
                return;
            }
            await this.memberLevelService.addGrowthValue(ctx, customerId, Math.floor(base), 'order_delivered');
            await this.memberLevelService.addPoints(ctx, customerId, points, order.id, 'order_delivered');
            core_1.Logger.info(`Order ${order.id} delivered: +${Math.floor(base)} growth, +${points} points for customer ${customerId}`, constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.error(`Failed to credit points for order ${order.id}: ${(_h = e === null || e === void 0 ? void 0 : e.message) !== null && _h !== void 0 ? _h : e}`, constants_1.loggerCtx);
        }
    }
    async handleRefundSettled(event) {
        var _a, _b, _c, _d, _e;
        const { ctx, order, refund } = event;
        if (!order.customer)
            return;
        const customerId = order.customer.id;
        try {
            const cf = (_a = ctx.channel.customFields) !== null && _a !== void 0 ? _a : {};
            const ratio = (_c = (_b = cf.pointsEarnRatio) !== null && _b !== void 0 ? _b : this.options.defaultPointsEarnRatio) !== null && _c !== void 0 ? _c : 1;
            const refundAmount = (_d = refund.total) !== null && _d !== void 0 ? _d : 0;
            const pointsToDeduct = Math.floor(refundAmount * ratio);
            if (pointsToDeduct <= 0)
                return;
            await this.memberLevelService.spendPoints(ctx, customerId, pointsToDeduct, order.id, `refund_settled:${refund.id}`);
            await this.memberLevelService.addGrowthValue(ctx, customerId, -Math.floor(refundAmount), 'refund_settled');
            core_1.Logger.info(`Refund ${refund.id} settled for order ${order.id}: -${Math.floor(refundAmount)} growth, -${pointsToDeduct} points for customer ${customerId}`, constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.error(`Failed to deduct points for refund on order ${order.id}: ${(_e = e === null || e === void 0 ? void 0 : e.message) !== null && _e !== void 0 ? _e : e}`, constants_1.loggerCtx);
        }
    }
};
exports.MemberLevelPlugin = MemberLevelPlugin;
MemberLevelPlugin.options = {};
exports.MemberLevelPlugin = MemberLevelPlugin = MemberLevelPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [member_points_history_entity_1.MemberPointsHistory],
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
            var _a, _b, _c, _d;
            config.customFields.Channel = [
                ...((_a = config.customFields.Channel) !== null && _a !== void 0 ? _a : []),
                ...((_b = channel_custom_fields_1.memberLevelChannelCustomFields.Channel) !== null && _b !== void 0 ? _b : []),
            ];
            config.customFields.Customer = [
                ...((_c = config.customFields.Customer) !== null && _c !== void 0 ? _c : []),
                ...((_d = customer_custom_fields_1.memberLevelCustomerCustomFields.Customer) !== null && _d !== void 0 ? _d : []),
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