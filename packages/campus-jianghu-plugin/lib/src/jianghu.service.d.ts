import { Customer, CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { JianghuEvent } from './jianghu-event.entity';
import { JianghuClue } from './jianghu-clue.entity';
import { JianghuIntel } from './jianghu-intel.entity';
import { JianghuProfile } from './jianghu-profile.entity';
import { JianghuRecord } from './jianghu-record.entity';
import { JianghuRiskService } from './jianghu-risk.service';
export interface JianghuVerifyResult {
    ok: boolean;
    deltaRep: number;
    rep: number;
    rankUp: boolean;
    rankCode?: string;
    rankName?: string;
    message?: string;
}
export interface RumorInput {
    category: 'FOOD' | 'CLASSROOM' | 'CLUB' | 'EVENT' | 'NOTICE' | 'SCENERY';
    content: string;
    sourceNote: string;
}
export interface TaskInput {
    type: 'LETTER' | 'INTEL' | 'PLOT';
    level: 'NORMAL' | 'URGENT' | 'SECRET';
    title: string;
    brief?: string;
    plainText?: string;
    campusCode?: string;
    buildingCode?: string;
    targetNick?: string;
    targetBuilding?: string;
    rewardRep?: number;
    verifyMode: 'CODE' | 'QR' | 'LBS' | 'ORDER_BIND';
    boundOrderId?: string;
    lat?: number;
    lng?: number;
}
export interface ClueInput {
    content: string;
    sourceNote: string;
}
export interface EventInput {
    name: string;
    desc: string;
    total?: number;
    perPersonLimit?: number;
    endAt?: string | null;
    rewardPoolRep?: number | null;
}
export declare class JianghuService {
    private connection;
    private customerService;
    private risk;
    constructor(connection: TransactionalConnection, customerService: CustomerService, risk: JianghuRiskService);
    private requireCustomer;
    getOrCreateProfile(ctx: RequestContext, customer: Customer): Promise<JianghuProfile>;
    private profileView;
    private taskView;
    myProfile(ctx: RequestContext): Promise<{
        rankName: string;
        customerId: number;
        nickname: string;
        rep: number;
        intel: number;
        rankCode: string;
        credit: number;
        letterDone: number;
        intelDone: number;
        plotDone: number;
        urgentDone: number;
        secretDone: number;
        repToday: number;
        repDailyCap: number;
        repDay: string | null;
        streakDays: number;
        lastActiveDay: string | null;
        protectedUntil: string | null;
        frozenUntil: string | null;
        violateCount: number;
        campusCode: string | null;
        customer?: Customer;
        channel?: import("@vendure/core").Channel;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    hall(ctx: RequestContext, type?: string, campusCode?: string, cursor?: string, limit?: number, lat?: number, lng?: number): Promise<any[]>;
    taskDetail(ctx: RequestContext, taskId: string): Promise<any>;
    myRecords(ctx: RequestContext, cursor?: string, limit?: number): Promise<JianghuRecord[]>;
    dailyRank(ctx: RequestContext, campusCode?: string): Promise<{
        customerId: string;
        nickname: string;
        rep: number;
        isMe: boolean;
    }[]>;
    intelMarket(ctx: RequestContext, campusCode?: string, cursor?: string, limit?: number): Promise<{
        categoryText: string;
        unlocked: boolean;
        category: "FOOD" | "CLASSROOM" | "CLUB" | "EVENT" | "NOTICE" | "SCENERY";
        campusCode: string | null;
        summary: string;
        content: string | null;
        sourceNote: string;
        priceIntel: number;
        viewCount: number;
        authorCustomerId: number | null;
        status: "PENDING" | "APPROVED" | "REJECTED";
        author?: Customer;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    eventCurrent(ctx: RequestContext, campusCode?: string): Promise<JianghuEvent | null>;
    /** P2 事件详情：拼图进度 + 线索墙 + 贡献者排行 + 我的状态（含破案奖励核算） */
    eventDetail(ctx: RequestContext, campusCode?: string): Promise<{
        clues: JianghuClue[];
        myClues: JianghuClue[];
        contributors: {
            customerId: string;
            nickname: string;
            count: number;
            isMe: boolean;
        }[];
        myContributed: number;
        solved: boolean;
        myRewardRep: number | undefined;
        rewarded: boolean;
        name: string;
        desc: string;
        total: number;
        collected: number;
        perPersonLimit: number;
        endAt: string | null;
        rewardPoolRep: number | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    /**
     * 运营后台：列出当前事件的线索（含 PENDING 待审），供审核使用。
     * 玩家侧不可见 PENDING，故此为 admin 专属查询，按创建时间倒序，可按 status 过滤。
     */
    listClues(ctx: RequestContext, status?: string, limit?: number): Promise<JianghuClue[]>;
    /** P2 提交线索：点亮一块拼图，集齐后触发破案均分奖励池 */
    collectClue(ctx: RequestContext, input: ClueInput): Promise<{
        clues: JianghuClue[];
        myClues: JianghuClue[];
        contributors: {
            customerId: string;
            nickname: string;
            count: number;
            isMe: boolean;
        }[];
        myContributed: number;
        solved: boolean;
        myRewardRep: number | undefined;
        rewarded: boolean;
        name: string;
        desc: string;
        total: number;
        collected: number;
        perPersonLimit: number;
        endAt: string | null;
        rewardPoolRep: number | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    /** 破案结算：奖励池按去重贡献者均分，幂等键防重复发放；贡献者 plotDone+1（对接 L8「组队破大案」） */
    private settleEvent;
    listProfiles(ctx: RequestContext, cursor?: string, limit?: number): Promise<{
        rankName: string;
        customerId: number;
        nickname: string;
        rep: number;
        intel: number;
        rankCode: string;
        credit: number;
        letterDone: number;
        intelDone: number;
        plotDone: number;
        urgentDone: number;
        secretDone: number;
        repToday: number;
        repDailyCap: number;
        repDay: string | null;
        streakDays: number;
        lastActiveDay: string | null;
        protectedUntil: string | null;
        frozenUntil: string | null;
        violateCount: number;
        campusCode: string | null;
        customer?: Customer;
        channel?: import("@vendure/core").Channel;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    listTasks(ctx: RequestContext, status?: string, limit?: number): Promise<any[]>;
    take(ctx: RequestContext, taskId: string): Promise<any>;
    release(ctx: RequestContext, taskId: string): Promise<boolean>;
    refreshCode(ctx: RequestContext, taskId: string): Promise<string>;
    private dailyPairCount;
    private fail;
    verify(ctx: RequestContext, taskId: string, code?: string, lat?: number, lng?: number): Promise<JianghuVerifyResult>;
    /** 声望入账：日上限裁剪 + 事务幂等（唯一键冲突视为已处理） */
    addRep(ctx: RequestContext, profile: JianghuProfile, delta: number, reason: string, taskId?: string): Promise<{
        deltaRep: number;
        rep: number;
    }>;
    private ensureDay;
    submitRumor(ctx: RequestContext, input: RumorInput): Promise<{
        id: any;
        status: string;
    }>;
    unlockIntel(ctx: RequestContext, intelId: string): Promise<{
        categoryText: string;
        unlocked: boolean;
        category: "FOOD" | "CLASSROOM" | "CLUB" | "EVENT" | "NOTICE" | "SCENERY";
        campusCode: string | null;
        summary: string;
        content: string | null;
        sourceNote: string;
        priceIntel: number;
        viewCount: number;
        authorCustomerId: number | null;
        status: "PENDING" | "APPROVED" | "REJECTED";
        author?: Customer;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createTask(ctx: RequestContext, input: TaskInput): Promise<any>;
    auditIntel(ctx: RequestContext, id: string, approve: boolean): Promise<JianghuIntel>;
    penalize(ctx: RequestContext, customerId: number | string, level: 'WARN' | 'BAN' | 'SEVERE'): Promise<{
        rankName: string;
        customerId: number;
        nickname: string;
        rep: number;
        intel: number;
        rankCode: string;
        credit: number;
        letterDone: number;
        intelDone: number;
        plotDone: number;
        urgentDone: number;
        secretDone: number;
        repToday: number;
        repDailyCap: number;
        repDay: string | null;
        streakDays: number;
        lastActiveDay: string | null;
        protectedUntil: string | null;
        frozenUntil: string | null;
        violateCount: number;
        campusCode: string | null;
        customer?: Customer;
        channel?: import("@vendure/core").Channel;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createEvent(ctx: RequestContext, input: EventInput): Promise<any>;
    auditClue(ctx: RequestContext, id: string, approve: boolean): Promise<JianghuClue>;
    /**
     * 拉取当前上架的江湖事件文案（Strapi 内容源）。
     * 运营在 h.joho.cn 可视化编辑并上架「江湖事件文案」，此处取 active=true 的那条。
     * 未配置 contentApi 或拉取失败（网络/鉴权）时优雅返回 null，前端回退到实体内联文案。
     */
    getEventContent(_ctx: RequestContext): Promise<JianghuEventContent | null>;
}
/** 江湖事件文案（Strapi 内容源）返回结构，与 schema 的 JianghuEventContent 对应 */
export interface JianghuEventContent {
    title: string | null;
    desc: string | null;
    bannerImage: string | null;
    rewardText: string | null;
    active: boolean | null;
}
