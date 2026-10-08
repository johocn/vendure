import { RequestContext } from '@vendure/core';
import { JianghuService } from './jianghu.service';
export declare class JianghuShopResolver {
    private service;
    constructor(service: JianghuService);
    jianghuProfile(ctx: RequestContext): Promise<{
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
        customer?: import("@vendure/core").Customer;
        channel?: import("@vendure/core").Channel;
        id: import("@vendure/core").ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    jianghuRankLadder(): import("./constants").RankTierConfig[];
    jianghuHall(ctx: RequestContext, args: {
        type?: string;
        campusCode?: string;
        cursor?: string;
        limit?: number;
        lat?: number;
        lng?: number;
    }): Promise<any[]>;
    jianghuTaskDetail(ctx: RequestContext, args: {
        taskId: string;
    }): Promise<any>;
    jianghuMyRecords(ctx: RequestContext, args: {
        cursor?: string;
        limit?: number;
    }): Promise<import("./jianghu-record.entity").JianghuRecord[]>;
    jianghuDailyRank(ctx: RequestContext, args: {
        campusCode?: string;
    }): Promise<{
        customerId: string;
        nickname: string;
        rep: number;
        isMe: boolean;
    }[]>;
    jianghuIntelMarket(ctx: RequestContext, args: {
        campusCode?: string;
        cursor?: string;
        limit?: number;
    }): Promise<{
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
        author?: import("@vendure/core").Customer;
        id: import("@vendure/core").ID;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    jianghuEventCurrent(ctx: RequestContext, args: {
        campusCode?: string;
    }): Promise<import("./jianghu-event.entity").JianghuEvent | null>;
    jianghuEventDetail(ctx: RequestContext): Promise<{
        clues: import("./jianghu-clue.entity").JianghuClue[];
        myClues: import("./jianghu-clue.entity").JianghuClue[];
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
        id: import("@vendure/core").ID;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    jianghuEventContent(ctx: RequestContext): Promise<import("./jianghu.service").JianghuEventContent | null>;
    jianghuTakeTask(ctx: RequestContext, args: {
        taskId: string;
    }): Promise<any>;
    jianghuReleaseTask(ctx: RequestContext, args: {
        taskId: string;
    }): Promise<boolean>;
    jianghuRefreshCode(ctx: RequestContext, args: {
        taskId: string;
    }): Promise<string>;
    jianghuVerify(ctx: RequestContext, args: {
        taskId: string;
        code?: string;
        lat?: number;
        lng?: number;
    }): Promise<import("./jianghu.service").JianghuVerifyResult>;
    jianghuSubmitRumor(ctx: RequestContext, args: {
        input: {
            category: any;
            content: string;
            sourceNote: string;
        };
    }): Promise<{
        id: any;
        status: string;
    }>;
    jianghuUnlockIntel(ctx: RequestContext, args: {
        intelId: string;
    }): Promise<{
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
        author?: import("@vendure/core").Customer;
        id: import("@vendure/core").ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    jianghuCollectClue(ctx: RequestContext, args: {
        input: {
            content: string;
            sourceNote: string;
        };
    }): Promise<{
        clues: import("./jianghu-clue.entity").JianghuClue[];
        myClues: import("./jianghu-clue.entity").JianghuClue[];
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
        id: import("@vendure/core").ID;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
