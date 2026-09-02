import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, TransactionalConnection } from '@vendure/core';
import { MerchantSettlementLedger } from './merchant-settlement-ledger.entity';

/**
 * 商户分账台账管理端查询（web-admin 后续使用）。
 * 仅做只读查询，不在此处执行任何写入。
 */
@Resolver()
export class MerchantSettlementAdminResolver {
    constructor(private connection: TransactionalConnection) {}

    @Query()
    @Allow(Permission.SuperAdmin)
    async merchantSettlementLedgers(
        @Ctx() ctx: RequestContext,
        @Args('orderId', { nullable: true }) orderId?: string,
    ): Promise<MerchantSettlementLedger[]> {
        const repo = this.connection.getRepository(ctx, MerchantSettlementLedger);
        if (orderId) {
            return repo.find({ where: { orderId } });
        }
        return repo.find({ order: { id: 'DESC' } as any });
    }
}