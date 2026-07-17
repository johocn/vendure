import { CustomerService, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { MemberPointsHistory, PointsHistoryType } from './member-points-history.entity';
export interface MemberInfo {
    customerId: ID;
    level: number;
    levelName: string;
    growthValue: number;
    points: number;
    nextLevelThreshold: number | null;
    nextLevelName: string | null;
}
export declare class MemberLevelService {
    private connection;
    private listQueryBuilder;
    private customerService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService);
    getMemberInfo(ctx: RequestContext, customerId: ID): Promise<MemberInfo>;
    getMyMemberInfo(ctx: RequestContext): Promise<MemberInfo>;
    addGrowthValue(ctx: RequestContext, customerId: ID, amount: number, source?: string): Promise<number>;
    addPoints(ctx: RequestContext, customerId: ID, amount: number, orderId?: ID | null, remark?: string | null): Promise<number>;
    spendPoints(ctx: RequestContext, customerId: ID, amount: number, orderId?: ID | null, remark?: string | null): Promise<number>;
    adjustPoints(ctx: RequestContext, customerId: ID, amount: number, remark?: string | null): Promise<number>;
    calculateLevel(ctx: RequestContext, growthValue: number): number;
    getMyPointsHistory(ctx: RequestContext, options?: ListQueryOptions<MemberPointsHistory>): Promise<PaginatedList<MemberPointsHistory>>;
    getPointsHistory(ctx: RequestContext, customerId: ID, options?: ListQueryOptions<MemberPointsHistory>): Promise<PaginatedList<MemberPointsHistory>>;
    hasPointsRecord(ctx: RequestContext, customerId: ID, orderId: ID, type: PointsHistoryType): Promise<boolean>;
    private applyPointsChange;
    private buildMemberInfo;
    private getLevelConfig;
    private getLevelName;
    private getNextLevel;
}
