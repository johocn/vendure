import { RequestContext } from '@vendure/core';
import { RechargeCardService } from './recharge-card.service';
export declare class RechargeCardAdminResolver {
    private rechargeCardService;
    constructor(rechargeCardService: RechargeCardService);
    rechargeCards(ctx: RequestContext, options: any): Promise<any>;
    rechargeCardBatches(ctx: RequestContext, options: any): Promise<any>;
    createRechargeCardBatch(ctx: RequestContext, input: any): Promise<any>;
    freezeRechargeCard(ctx: RequestContext, id: number): Promise<any>;
    unfreezeRechargeCard(ctx: RequestContext, id: number): Promise<any>;
}
