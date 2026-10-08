"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JIANGHU_ADMIN_API = exports.JIANGHU_SHOP_API = exports.JIANGHU_TYPES = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
/** 江湖域公共类型（shop 与 admin 两套 schema 各自引用） */
exports.JIANGHU_TYPES = (0, graphql_tag_1.default) `
    type JianghuProfile {
        id: ID!
        customerId: ID!
        nickname: String!
        rep: Int!
        intel: Int!
        rankCode: String!
        rankName: String
        credit: Int!
        letterDone: Int!
        intelDone: Int!
        plotDone: Int!
        urgentDone: Int
        secretDone: Int
        repToday: Int!
        repDailyCap: Int!
        streakDays: Int
        protectedUntil: String
        frozenUntil: String
        violateCount: Int
    }

    type JianghuTask {
        id: ID!
        type: String!
        level: String!
        title: String!
        brief: String
        plainText: String
        campusCode: String
        buildingCode: String
        targetNick: String
        targetBuilding: String
        rewardRep: Int!
        rewardIntel: Int
        verifyMode: String!
        boundOrderId: String
        status: String!
        verifyCode: String
        codeExpireAt: String
        tryCount: Int
        expireInSec: Int
        # 任务自身坐标（LBS 围栏用）
        lat: Float
        lng: Float
        # 大厅态：骑手位置已知时由服务端算出的距离（公里），否则为空
        distanceKm: Float
    }

    type JianghuRecord {
        id: ID!
        taskId: ID
        reason: String!
        reasonText: String
        deltaRep: Int!
        deltaIntel: Int
        snapshotRep: Int
        createdAt: DateTime!
    }

    type JianghuIntel {
        id: ID!
        category: String!
        categoryText: String
        campusCode: String
        summary: String!
        content: String
        sourceNote: String
        priceIntel: Int!
        viewCount: Int!
        unlocked: Boolean!
    }

    type JianghuEvent {
        id: ID!
        name: String!
        desc: String!
        total: Int!
        collected: Int!
        perPersonLimit: Int!
        endAt: String
        rewardPoolRep: Int
    }

    type JianghuClue {
        id: ID!
        eventId: ID!
        nickname: String
        content: String!
        sourceNote: String
        campusCode: String
        likes: Int!
        status: String
        createdAt: String
    }

    type JianghuEventDetail {
        id: ID!
        name: String!
        desc: String!
        total: Int!
        collected: Int!
        perPersonLimit: Int!
        endAt: String
        rewardPoolRep: Int
        clues: [JianghuClue!]!
        myClues: [JianghuClue!]!
        contributors: [JianghuContributor!]!
        myContributed: Int!
        solved: Boolean!
        myRewardRep: Int
        rewarded: Boolean
    }

    type JianghuContributor {
        customerId: ID!
        nickname: String!
        count: Int!
        isMe: Boolean
    }

    type RankTier {
        code: String!
        name: String!
        rep: Int!
        realm: String!
        seal: String!
        conditionText: String!
        perksVirtual: [String!]!
        perksReal: [String!]!
    }

    type JianghuRankRow {
        customerId: ID!
        nickname: String!
        rep: Int!
        isMe: Boolean
    }

    type JianghuVerifyResult {
        ok: Boolean!
        deltaRep: Int!
        rep: Int!
        rankUp: Boolean!
        rankCode: String
        rankName: String
        message: String
    }

    type JianghuSubmitResult {
        id: ID!
        status: String!
    }

    # 江湖事件文案（Strapi 内容源）：运营在 h.joho.cn 可视化编辑上架，覆盖实体内联文案。
    # 未配置/不可达时返回 null，前端回退到实体字段。
    type JianghuEventContent {
        title: String
        desc: String
        bannerImage: String
        rewardText: String
        active: Boolean
    }
`;
exports.JIANGHU_SHOP_API = (0, graphql_tag_1.default) `
    extend type Query {
        jianghuProfile: JianghuProfile
        jianghuRankLadder: [RankTier!]!
        jianghuHall(type: String, campusCode: String, cursor: String, limit: Int, lat: Float, lng: Float): [JianghuTask!]!
        jianghuTaskDetail(taskId: ID!): JianghuTask
        jianghuMyRecords(cursor: String, limit: Int): [JianghuRecord!]!
        jianghuDailyRank(campusCode: String): [JianghuRankRow!]!
        jianghuIntelMarket(campusCode: String, cursor: String, limit: Int): [JianghuIntel!]!
        jianghuEventCurrent(campusCode: String): JianghuEvent
        jianghuEventDetail: JianghuEventDetail
        jianghuEventContent: JianghuEventContent
    }

    extend type Mutation {
        jianghuTakeTask(taskId: ID!): JianghuTask!
        jianghuReleaseTask(taskId: ID!): Boolean!
        jianghuRefreshCode(taskId: ID!): String!
        jianghuVerify(taskId: ID!, code: String, lat: Float, lng: Float): JianghuVerifyResult!
        jianghuSubmitRumor(input: RumorInput!): JianghuSubmitResult!
        jianghuUnlockIntel(intelId: ID!): JianghuIntel!
        jianghuCollectClue(input: ClueInput!): JianghuEventDetail!
    }

    input RumorInput {
        category: String!
        content: String!
        sourceNote: String!
    }

    input ClueInput {
        content: String!
        sourceNote: String!
    }
`;
exports.JIANGHU_ADMIN_API = (0, graphql_tag_1.default) `
    extend type Query {
        jianghuListProfiles(cursor: String, limit: Int): [JianghuProfile!]!
        jianghuListTasks(status: String, limit: Int): [JianghuTask!]!
        jianghuListClues(status: String, limit: Int): [JianghuClue!]!
    }

    extend type Mutation {
        jianghuCreateTask(input: JianghuTaskInput!): JianghuTask!
        jianghuAuditIntel(id: ID!, approve: Boolean!): JianghuIntel!
        jianghuPenalize(customerId: ID!, level: String!): JianghuProfile!
        jianghuCreateEvent(input: JianghuEventInput!): JianghuEvent!
        jianghuAuditClue(id: ID!, approve: Boolean!): JianghuClue!
    }

    input JianghuTaskInput {
        type: String!
        level: String!
        title: String!
        brief: String
        plainText: String
        campusCode: String
        buildingCode: String
        targetNick: String
        targetBuilding: String
        rewardRep: Int
        verifyMode: String!
        boundOrderId: String
        lat: Float
        lng: Float
    }

    input JianghuEventInput {
        name: String!
        desc: String!
        total: Int
        perPersonLimit: Int
        endAt: String
        rewardPoolRep: Int
    }
`;
//# sourceMappingURL=schema.js.map