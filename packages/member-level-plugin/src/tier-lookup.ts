import { Injectable } from '@nestjs/common';
import { Customer, ID, Injector, RequestContext, TransactionalConnection } from '@vendure/core';

import { MemberTier } from './member-tier.entity';

// 免运费 checker / 专属折扣 condition+action 都是 configurable-operation（非 Nest provider），
// 无法直接注入 MemberLevelService。这里用一个模块级持有 connection 的轻量 lookup，
// 经 init(injector) 注入，统一封装「按 customer 解析档位」的查询逻辑（与 service 表驱动同口径）。
// 避免与 MemberLevelService 互相依赖形成假循环，也避免重复手写查询散落各处。
@Injectable()
export class MemberTierLookup {
    private connection: TransactionalConnection | undefined;

    init(injector: Injector): void {
        this.connection = injector.get(TransactionalConnection) as TransactionalConnection;
    }

    private repo(ctx: RequestContext) {
        if (!this.connection) {
            throw new Error('MemberTierLookup not initialized');
        }
        return this.connection.getRepository(ctx, MemberTier);
    }

    /** 按顾客解析当前档位（读 customFields.growthValue → 表驱动 threshold<=growth 最大档）。 */
    async tierForCustomer(ctx: RequestContext, customerId: ID): Promise<MemberTier> {
        const customerRepo = this.connection!.getRepository(ctx, Customer);
        const customer = await customerRepo.findOne({
            where: { id: customerId as any } as any,
        });
        const growth = (customer as any)?.customFields?.growthValue ?? 0;
        return this.tierForGrowth(ctx, growth);
    }

    /** 按成长值解析档位：查表取 threshold<=growth 的最大档；无记录返回最低档（threshold 0）。 */
    async tierForGrowth(ctx: RequestContext, growthValue: number): Promise<MemberTier> {
        const all = await this.repo(ctx).find({
            where: { channelId: ctx.channelId as number } as any,
            order: { tierLevel: 'ASC' },
        });
        if (all.length === 0) {
            return {
                tierLevel: 1,
                threshold: 0,
                name: '普通会员',
                pointsMultiplier: 1000,
                redeemDiscountRate: 1000,
                redeemCapRatio: 500,
                specialDiscountRate: 0,
            } as MemberTier;
        }
        let hit = all[0];
        for (const t of all) {
            if (growthValue >= t.threshold) {
                hit = t;
            }
        }
        return hit;
    }
}

// 模块级单例，供 configurable-operation 的 init() 注入持有。
export const memberTierLookup = new MemberTierLookup();