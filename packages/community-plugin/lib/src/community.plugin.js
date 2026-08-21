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
var CommunityPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityPlugin = void 0;
const core_1 = require("@vendure/core");
const operators_1 = require("rxjs/operators");
const constants_1 = require("./constants");
const community_admin_resolver_1 = require("./community-admin.resolver");
const community_activity_entity_1 = require("./community-activity.entity");
const community_activity_item_entity_1 = require("./community-activity-item.entity");
const community_commission_entry_entity_1 = require("./community-commission-entry.entity");
const community_leader_entity_1 = require("./community-leader.entity");
const community_participation_entity_1 = require("./community-participation.entity");
const community_service_1 = require("./community.service");
const community_leader_resolver_1 = require("./community-leader.resolver");
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
const adminSchema = gql `
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
const shopSchema = gql `
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
let CommunityPlugin = CommunityPlugin_1 = class CommunityPlugin {
    constructor(service, eventBus) {
        this.service = service;
        this.eventBus = eventBus;
    }
    static init(options) {
        CommunityPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return CommunityPlugin_1;
    }
    onApplicationBootstrap() {
        // 必修点：本仓默认订单状态机只有 Delivered（无 Completed），故 filter 仅判断 Delivered。
        this.eventBus
            .ofType(core_1.OrderStateTransitionEvent)
            .pipe((0, operators_1.filter)(e => e.toState === 'Delivered'))
            .subscribe(e => {
            this.service.handleOrderStateTransition(e).catch(err => core_1.Logger.error(err === null || err === void 0 ? void 0 : err.message, 'community-plugin'));
        });
    }
};
exports.CommunityPlugin = CommunityPlugin;
CommunityPlugin.options = {};
exports.CommunityPlugin = CommunityPlugin = CommunityPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.COMMUNITY_PLUGIN_OPTIONS, useFactory: () => CommunityPlugin.options },
            community_service_1.CommunityService,
        ],
        entities: [
            community_leader_entity_1.CommunityLeader,
            community_activity_entity_1.CommunityActivity,
            community_activity_item_entity_1.CommunityActivityItem,
            community_participation_entity_1.CommunityParticipation,
            community_commission_entry_entity_1.CommunityCommissionEntry,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [community_admin_resolver_1.CommunityAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [community_leader_resolver_1.CommunityLeaderResolver],
        },
    }),
    __metadata("design:paramtypes", [community_service_1.CommunityService, core_1.EventBus])
], CommunityPlugin);
//# sourceMappingURL=community.plugin.js.map