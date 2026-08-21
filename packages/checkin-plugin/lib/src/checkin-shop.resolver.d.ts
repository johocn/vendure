import { RequestContext } from '@vendure/core';
import { CheckinService } from './checkin.service';
import { CheckinTodayInfo, CreditResult, TaskSummary } from './types';
export declare class CheckinShopResolver {
    private checkinService;
    constructor(checkinService: CheckinService);
    checkinToday(ctx: RequestContext): Promise<CheckinTodayInfo>;
    myTasks(ctx: RequestContext): Promise<TaskSummary[]>;
    checkin(ctx: RequestContext): Promise<CreditResult>;
    claimTask(ctx: RequestContext, taskCode: string): Promise<CreditResult>;
}
