import { ChannelService, CustomerService, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
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
export interface ChannelLevelConfig {
    level1Threshold: number;
    level1Name: string;
    level2Threshold: number;
    level2Name: string;
    level3Threshold: number;
    level3Name: string;
    level4Threshold: number;
    level4Name: string;
    level5Threshold: number;
    level5Name: string;
    pointsEarnRatio: number;
    pointsEarnOnShipping: boolean;
}
export interface MemberListItem {
    customerId: ID;
    emailAddress: string | null;
    firstName: string | null;
    lastName: string | null;
    level: number;
    levelName: string;
    growthValue: number;
    points: number;
    createdAt: Date;
}
export declare class MemberLevelService {
    private connection;
    private listQueryBuilder;
    private customerService;
    private channelService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService, channelService: ChannelService);
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
    findAllMembers(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        filter?: {
            emailAddress?: string;
            level?: number;
        };
    }): Promise<PaginatedList<MemberListItem>>;
    getLevelConfig(ctx: RequestContext): ChannelLevelConfig;
    updateLevelConfig(ctx: RequestContext, input: Partial<ChannelLevelConfig>): Promise<ChannelLevelConfig>;
    private applyPointsChange;
    private buildMemberInfo;
    private getLevelThresholds;
    private getLevelName;
    private getNextLevel;
}
