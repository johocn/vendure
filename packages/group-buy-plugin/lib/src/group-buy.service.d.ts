import { ChannelService, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
export declare class GroupBuyService {
    private connection;
    private listQueryBuilder;
    private channelService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, channelService: ChannelService);
    findAll(ctx: RequestContext, options?: ListQueryOptions<GroupBuyActivity>): Promise<PaginatedList<GroupBuyActivity>>;
    findOne(ctx: RequestContext, id: ID): Promise<GroupBuyActivity | undefined>;
    create(ctx: RequestContext, input: Partial<GroupBuyActivity>): Promise<GroupBuyActivity>;
    update(ctx: RequestContext, input: any): Promise<GroupBuyActivity>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    joinGroupBuy(ctx: RequestContext, activityId: ID, orderId: ID, isLeader: boolean): Promise<GroupBuyOrder>;
    findActiveByVariant(ctx: RequestContext, variantId: ID): Promise<GroupBuyActivity[]>;
}
