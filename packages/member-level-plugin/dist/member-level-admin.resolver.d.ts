import { ID, RequestContext } from '@vendure/core';
import { MemberLevelService } from './member-level.service';
export declare class MemberLevelAdminResolver {
    private memberLevelService;
    constructor(memberLevelService: MemberLevelService);
    memberInfo(ctx: RequestContext, customerId: ID): Promise<any>;
    pointsHistory(ctx: RequestContext, customerId: ID, options: any): Promise<any>;
    adjustPoints(ctx: RequestContext, customerId: ID, amount: number, remark?: string): Promise<any>;
}
