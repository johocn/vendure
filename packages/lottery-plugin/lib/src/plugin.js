"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LotteryPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LotteryPlugin = void 0;
const core_1 = require("@vendure/core");
const lottery_prize_entity_1 = require("./lottery-prize.entity");
const lottery_record_entity_1 = require("./lottery-record.entity");
const lottery_resolvers_1 = require("./lottery.resolvers");
const lottery_service_1 = require("./lottery.service");
const { gql } = require('graphql-tag');
const shopSchema = () => gql `
    type LotteryPrizeInfo implements Node {
        id: ID!
        name: String!
        image: String
        consume: Int!
    }
    type LotteryRecord implements Node {
        id: ID!
        customerId: ID!
        prizeId: ID!
        prizeName: String!
        prizeImage: String
        consume: Int!
        createdAt: DateTime
    }
    type LotteryRecordList implements PaginatedList {
        items: [LotteryRecord!]!
        totalItems: Int!
    }
    input LotteryRecordListOptions {
        skip: Int
        take: Int
    }
    type LotteryDrawResult {
        prizeIndex: Int!
        prize: LotteryPrizeInfo!
    }
    extend type Query {
        myLotteryPrizes: [LotteryPrizeInfo!]!
        myLotteryRecords(options: LotteryRecordListOptions): LotteryRecordList!
    }
    extend type Mutation {
        drawLottery: LotteryDrawResult!
    }
`;
const adminSchema = () => gql `
    type LotteryPrize implements Node {
        id: ID!
        name: String!
        image: String
        weight: Int!
        consume: Int!
        stock: Int
        enabled: Boolean!
        sort: Int!
    }
    type LotteryPrizeList implements PaginatedList {
        items: [LotteryPrize!]!
        totalItems: Int!
    }
    input LotteryPrizeListOptions {
        skip: Int
        take: Int
    }
    type LotteryRecord implements Node {
        id: ID!
        customerId: ID!
        prizeId: ID!
        prizeName: String!
        prizeImage: String
        consume: Int!
        channelId: ID!
        createdAt: DateTime
    }
    type LotteryRecordList implements PaginatedList {
        items: [LotteryRecord!]!
        totalItems: Int!
    }
    input LotteryRecordListOptions {
        skip: Int
        take: Int
    }
    input CreateLotteryPrizeInput {
        name: String!
        image: String
        weight: Int!
        consume: Int!
        stock: Int
        enabled: Boolean
        sort: Int
    }
    input UpdateLotteryPrizeInput {
        id: ID!
        name: String
        image: String
        weight: Int
        consume: Int
        stock: Int
        enabled: Boolean
        sort: Int
    }
    extend type Query {
        lotteryPrizes(options: LotteryPrizeListOptions): LotteryPrizeList!
        lotteryRecords(options: LotteryRecordListOptions): LotteryRecordList!
    }
    extend type Mutation {
        createLotteryPrize(input: CreateLotteryPrizeInput!): LotteryPrize!
        updateLotteryPrize(input: UpdateLotteryPrizeInput!): LotteryPrize!
        deleteLotteryPrize(id: ID!): Boolean!
    }
`;
/**
 * 九宫格积分抽奖（usemall F20 对齐）：
 * - 后台配置奖品（名称/图片/权重/消耗积分/库存），服务端加权开奖返回 prizeIndex；
 * - 每次抽中按奖品 consume 经 MemberLevelService.spendPoints 桥扣积分（软依赖，需与 MemberLevelPlugin 同容器）。
 */
let LotteryPlugin = LotteryPlugin_1 = class LotteryPlugin {
    static init() {
        return LotteryPlugin_1;
    }
};
exports.LotteryPlugin = LotteryPlugin;
exports.LotteryPlugin = LotteryPlugin = LotteryPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [lottery_prize_entity_1.LotteryPrize, lottery_record_entity_1.LotteryRecord],
        providers: [lottery_service_1.LotteryService],
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [lottery_resolvers_1.LotteryShopResolver],
        },
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [lottery_resolvers_1.LotteryAdminResolver],
        },
        compatibility: '^3.0.0',
    })
], LotteryPlugin);
//# sourceMappingURL=plugin.js.map