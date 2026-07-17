import { ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { RechargeCard } from './recharge-card.entity';
import { RechargeCardBatch } from './recharge-card-batch.entity';
import { RechargeCardService } from './recharge-card.service';
export declare class RechargeCardAdminResolver {
    private rechargeCardService;
    constructor(rechargeCardService: RechargeCardService);
    rechargeCards(ctx: RequestContext, options: ListQueryOptions<RechargeCard>): Promise<PaginatedList<RechargeCard>>;
    rechargeCardBatches(ctx: RequestContext, options: ListQueryOptions<RechargeCardBatch>): Promise<PaginatedList<RechargeCardBatch>>;
    createRechargeCardBatch(ctx: RequestContext, input: any): Promise<any>;
    freezeRechargeCard(ctx: RequestContext, id: number): Promise<any>;
    unfreezeRechargeCard(ctx: RequestContext, id: number): Promise<any>;
}
