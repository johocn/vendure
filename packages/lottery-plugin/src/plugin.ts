import { Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { LotteryPrize } from './lottery-prize.entity';
import { LotteryRecord } from './lottery-record.entity';
import { LotteryAdminResolver, LotteryShopResolver } from './lottery.resolvers';
import { LotteryService } from './lottery.service';

const { gql } = require('graphql-tag');

const shopSchema = () => gql`
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

const adminSchema = () => gql`
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
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [LotteryPrize, LotteryRecord],
    providers: [LotteryService],
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [LotteryShopResolver],
    },
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [LotteryAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class LotteryPlugin {
    static init(): Type<LotteryPlugin> {
        return LotteryPlugin;
    }
}
