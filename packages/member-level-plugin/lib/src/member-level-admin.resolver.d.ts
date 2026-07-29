import { ID, RequestContext } from '@vendure/core';
import { MemberLevelService } from './member-level.service';
export declare class MemberLevelAdminResolver {
    private memberLevelService;
    constructor(memberLevelService: MemberLevelService);
    memberInfo(ctx: RequestContext, customerId: ID): Promise<any>;
    pointsHistory(ctx: RequestContext, customerId: ID, options: any): Promise<any>;
    members(ctx: RequestContext, options: any): Promise<any>;
    levelConfig(ctx: RequestContext): Promise<any>;
    adjustPoints(ctx: RequestContext, customerId: ID, amount: number, remark?: string): Promise<any>;
    adjustMemberGrowth(ctx: RequestContext, customerId: ID, amount: number, source?: string): Promise<any>;
    updateLevelConfig(ctx: RequestContext, input: any): Promise<any>;
}
