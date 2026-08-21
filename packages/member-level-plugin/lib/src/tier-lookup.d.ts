import { ID, Injector, RequestContext } from '@vendure/core';
import { MemberTier } from './member-tier.entity';
export declare class MemberTierLookup {
    private connection;
    init(injector: Injector): void;
    private repo;
    /** 按顾客解析当前档位（读 customFields.growthValue → 表驱动 threshold<=growth 最大档）。 */
    tierForCustomer(ctx: RequestContext, customerId: ID): Promise<MemberTier>;
    /** 按成长值解析档位：查表取 threshold<=growth 的最大档；无记录返回最低档（threshold 0）。 */
    tierForGrowth(ctx: RequestContext, growthValue: number): Promise<MemberTier>;
}
export declare const memberTierLookup: MemberTierLookup;
