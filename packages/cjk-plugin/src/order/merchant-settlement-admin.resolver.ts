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
        // 全局渠道（superadmin）看全部；租户/门店管理按当前渠道隔离：既看本渠道作为商品归属商户的
        // 分账（tenantChannelId），也看本渠道经手到店核销收款的记录（collectorChannelId，核销人即收款人）。
        if (Number(ctx.channelId) !== 1) {
            const cid = String(ctx.channelId);
            qb.andWhere('(l.tenantChannelId = :cid OR l.collectorChannelId = :cid)', { cid });
        }
        if (orderId) {
            qb.andWhere('l.orderId = :oid', { oid: String(orderId) });
        }
        qb.orderBy('COALESCE(l.collectedAt, l.occurredAt)', 'DESC');
        qb.addOrderBy('l.id', 'DESC');
        return qb.getMany();
    }
}