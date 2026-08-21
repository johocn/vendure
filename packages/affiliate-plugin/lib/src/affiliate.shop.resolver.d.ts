import { ID, RequestContext } from '@vendure/core';
import { Affiliate } from './affiliate.entity';
import { AffiliateRelation } from './affiliate-relation.entity';
import { AffiliateCommissionEntry } from './affiliate-commission.entity';
import { AffiliateWithdrawal } from './affiliate-withdrawal.entity';
import { AffiliateService } from './affiliate.service';
/**
 * C 端分销接口。身份均从 activeUserId 解析（推广员档案 / 顾客绑定），无需额外权限参数。
 */
export declare class AffiliateShopResolver {
    private service;
    constructor(service: AffiliateService);
    /** 当前用户的推广员档案。 */
    myAffiliate(ctx: RequestContext): Promise<Affiliate | undefined>;
    /** 当前用户的佣金明细（createdAt DESC）。 */
    myCommissionEntries(ctx: RequestContext): Promise<AffiliateCommissionEntry[]>;
    /** 成为推广员（shopId 可空，空=全局推广）。 */
    becomeAffiliate(ctx: RequestContext, shopId?: ID): Promise<Affiliate>;
    /** 顾客绑定推广关系。 */
    bindAffiliate(ctx: RequestContext, code: string, source?: string): Promise<AffiliateRelation>;
    /** 申请提现。 */
    requestWithdrawal(ctx: RequestContext, amount: number): Promise<AffiliateWithdrawal>;
}
