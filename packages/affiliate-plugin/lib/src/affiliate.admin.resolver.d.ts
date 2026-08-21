import { ID, RequestContext } from '@vendure/core';
import { Affiliate } from './affiliate.entity';
import { AffiliateWithdrawal } from './affiliate-withdrawal.entity';
import { AffiliateService } from './affiliate.service';
/**
 * 管理端分销接口。affiliates 返回本 channel 全量推广员；pay/reject 提现经 service.requireMyShop
 * 校验调用者为 active 店主（归属隔离由 Shop.administratorId 把关）。
 */
export declare class AffiliateAdminResolver {
    private service;
    constructor(service: AffiliateService);
    /** 本 channel 全量推广员。 */
    affiliates(ctx: RequestContext): Promise<Affiliate[]>;
    /** 店主支付提现（幂等）。schema 仅需 Authenticated 保底，真正授权由 service.requireMyShop 把关。 */
    payWithdrawal(ctx: RequestContext, id: ID): Promise<AffiliateWithdrawal>;
    /** 店主拒绝提现（幂等）。 */
    rejectWithdrawal(ctx: RequestContext, id: ID): Promise<AffiliateWithdrawal>;
}
