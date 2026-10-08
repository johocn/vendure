import { RequestContext } from '@vendure/core';
import { JianghuService, TaskInput, EventInput } from './jianghu.service';
export declare class JianghuAdminResolver {
    private service;
    constructor(service: JianghuService);
    jianghuListProfiles(ctx: RequestContext, args: {
        cursor?: string;
        limit?: number;
    }): Promise<{
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
    }[]>;
    jianghuListTasks(ctx: RequestContext, args: {
        status?: string;
        limit?: number;
    }): Promise<any[]>;
    jianghuListClues(ctx: RequestContext, args: {
        status?: string;
        limit?: number;
    }): Promise<import("./jianghu-clue.entity").JianghuClue[]>;
    jianghuCreateTask(ctx: RequestContext, args: {
        input: TaskInput;
    }): Promise<any>;
    jianghuAuditIntel(ctx: RequestContext, args: {
        id: string;
        approve: boolean;
    }): Promise<import("./jianghu-intel.entity").JianghuIntel>;
    jianghuPenalize(ctx: RequestContext, args: {
        customerId: string;
        level: string;
    }): Promise<{
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
    jianghuCreateEvent(ctx: RequestContext, args: {
        input: EventInput;
    }): Promise<any>;
    jianghuAuditClue(ctx: RequestContext, args: {
        id: string;
        approve: boolean;
    }): Promise<import("./jianghu-clue.entity").JianghuClue>;
}
