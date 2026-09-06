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
    @Allow(Permission.UpdateOrder, Permission.SuperAdmin)
    async merchantSettlementLedgers(
        @Ctx() ctx: RequestContext,
        @Args('orderId', { nullable: true }) orderId?: string,
    ): Promise<MerchantSettlementLedger[]> {
        const repo = this.connection.getRepository(ctx, MerchantSettlementLedger);
        const qb = repo.createQueryBuilder('l');
        // 全局渠道（superadmin）看全部；租户/门店管理按当前渠道隔离，只看本店台账
        if (Number(ctx.channelId) !== 1) {
            qb.where('l.tenantChannelId = :cid', { cid: String(ctx.channelId) });
        }
        if (orderId) {
            qb.andWhere('l.orderId = :oid', { oid: String(orderId) });
        }
        qb.orderBy('l.occurredAt', 'DESC').addOrderBy('l.id', 'DESC');
        return qb.getMany();
    }
}