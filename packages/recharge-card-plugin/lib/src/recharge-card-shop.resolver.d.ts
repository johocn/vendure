import { RequestContext } from '@vendure/core';
import { RechargeCardService } from './recharge-card.service';
export declare class RechargeCardShopResolver {
    private rechargeCardService;
    constructor(rechargeCardService: RechargeCardService);
    myRechargeBalance(ctx: RequestContext): Promise<number>;
    myRechargeHistory(ctx: RequestContext): Promise<any[]>;
    redeemRechargeCard(ctx: RequestContext, code: string, pin: string): Promise<any>;
}
