import { ID, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { CommunityPluginOptions } from './constants';
import { CommunityActivity, CommunityActivityStatus } from './community-activity.entity';
import { CommunityParticipation } from './community-participation.entity';
import { CommunityLeader, CommunityLeaderStatus } from './community-leader.entity';
import { OrderStateTransitionEvent } from '@vendure/core';
export declare class CommunityService {
    private options;
    private connection;
    private orderService;
    constructor(options: CommunityPluginOptions, connection: TransactionalConnection, orderService: OrderService);
    private getLeaderOf;
    /** 买家申请成为团长（绑定自提点）。 */
    applyLeader(ctx: RequestContext, pickupLocationId: ID): Promise<CommunityLeader>;
    /** 平台审核团长。 */
    setLeaderStatus(ctx: RequestContext, leaderId: ID, status: CommunityLeaderStatus): Promise<CommunityLeader>;
    /** 团长开团（须 active）。 */
    createActivity(ctx: RequestContext, input: any): Promise<CommunityActivity>;
    setActivityStatus(ctx: RequestContext, activityId: ID, status: CommunityActivityStatus): Promise<CommunityActivity>;
    /** 邻居参团：把正式订单绑定到活动（幂等）。 */
    participate(ctx: RequestContext, orderId: ID, activityId: ID, subtotal: number): Promise<CommunityParticipation>;
    /** 截单成团：取期内已付款参与订单推进履约（幂等，仅一次）。 */
    cutoverActivity(ctx: RequestContext, activityId: ID): Promise<CommunityActivity>;
    /** 结算期：订单达履约完成 → 单列团长佣金（幂等）。 */
    settleCommission(ctx: RequestContext, order: Order): Promise<void>;
    /** 团长查询。 */
    myActivities(ctx: RequestContext, options?: any): Promise<{
        items: CommunityActivity[];
        totalItems: number;
    }>;
    myCommission(ctx: RequestContext): Promise<{
        totalCommission: number;
    }>;
    /** 平台全局查询。 */
    activities(ctx: RequestContext, options?: any): Promise<{
        items: CommunityActivity[];
        totalItems: number;
    }>;
    participations(ctx: RequestContext, options?: any): Promise<{
        items: CommunityParticipation[];
        totalItems: number;
    }>;
    handleOrderStateTransition(event: OrderStateTransitionEvent): Promise<void>;
}
