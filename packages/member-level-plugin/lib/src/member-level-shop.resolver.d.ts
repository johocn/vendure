import { RequestContext } from '@vendure/core';
import { MemberLevelService } from './member-level.service';
export declare class MemberLevelShopResolver {
    private memberLevelService;
    constructor(memberLevelService: MemberLevelService);
    myMemberInfo(ctx: RequestContext): Promise<any>;
    myPointsHistory(ctx: RequestContext, options: any): Promise<any>;
    redeemPoints(ctx: RequestContext, points: number): Promise<any>;
}
