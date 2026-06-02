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
var GroupBuyPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupBuyPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const group_buy_activity_entity_1 = require("./group-buy-activity.entity");
const group_buy_order_entity_1 = require("./group-buy-order.entity");
const group_buy_service_1 = require("./group-buy.service");
const group_buy_admin_resolver_1 = require("./group-buy-admin.resolver");
const group_buy_shop_resolver_1 = require("./group-buy-shop.resolver");
const group_buy_job_1 = require("./group-buy.job");
const order_custom_fields_1 = require("./order-custom-fields");
const group_buy_promotion_condition_1 = require("./group-buy-promotion-condition");
const group_buy_leader_promotion_1 = require("./group-buy-leader-promotion");
const { gql } = require('graphql-tag');
let GroupBuyPlugin = GroupBuyPlugin_1 = class GroupBuyPlugin {
    constructor(options, groupBuyJob) {
        this.options = options;
        this.groupBuyJob = groupBuyJob;
    }
    static init(options) {
        GroupBuyPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return GroupBuyPlugin_1;
    }
    async onApplicationBootstrap() {
        await this.groupBuyJob.init();
        this.groupBuyJob.scheduleCheck();
        core_1.Logger.info('GroupBuyPlugin initialized', constants_1.loggerCtx);
    }
};
exports.GroupBuyPlugin = GroupBuyPlugin;
GroupBuyPlugin.options = {};
exports.GroupBuyPlugin = GroupBuyPlugin = GroupBuyPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [group_buy_activity_entity_1.GroupBuyActivity, group_buy_order_entity_1.GroupBuyOrder],
        providers: [
            { provide: constants_1.GROUP_BUY_PLUGIN_OPTIONS, useFactory: () => GroupBuyPlugin.options },
            group_buy_service_1.GroupBuyService,
            group_buy_job_1.GroupBuyJob,
        ],
        adminApiExtensions: {
            schema: () => gql `
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
            resolvers: [group_buy_admin_resolver_1.GroupBuyAdminResolver],
        },
        shopApiExtensions: {
            schema: () => gql `
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
            resolvers: [group_buy_shop_resolver_1.GroupBuyShopResolver],
        },
        configuration: (config) => {
            var _a, _b, _c;
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [
                    ...((_b = (_a = config.customFields) === null || _a === void 0 ? void 0 : _a.Order) !== null && _b !== void 0 ? _b : []),
                    ...order_custom_fields_1.groupBuyOrderCustomFields.Order,
                ] });
            config.promotionOptions = config.promotionOptions || {};
            config.promotionOptions.promotionConditions = [
                ...((_c = config.promotionOptions.promotionConditions) !== null && _c !== void 0 ? _c : []),
                group_buy_promotion_condition_1.groupBuyDiscountCondition,
                group_buy_leader_promotion_1.groupBuyLeaderRewardCondition,
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.GROUP_BUY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, group_buy_job_1.GroupBuyJob])
], GroupBuyPlugin);
//# sourceMappingURL=plugin.js.map