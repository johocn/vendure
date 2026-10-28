import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { BillPayService } from './bill-pay.service';
import { BillPayPermissions } from './constants';
import { BillPayStatus } from './types';

/**
 * 代买单工作台（admin-api）：改价、接单、凭证回传、结算、人工退款，
 * 以及商家协议 / 渠道配置维护。权限为自定义 BillPayManage（注册于 plugin configuration）。
 */
@Resolver()
export class BillPayAdminResolver {
    constructor(private billPayService: BillPayService) {}

    @Query()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async billPayOrdersAdmin(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: { skip?: number; take?: number; status?: BillPayStatus },
    ) {
        const { items, totalItems } = await this.billPayService.adminList(ctx, {
            skip: options?.skip ?? 0,
            take: options?.take ?? 20,
            status: options?.status ?? undefined,
        });
        return { items: items.map(o => this.billPayService.toGraph(o)), totalItems };
    }

    @Query()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async billPayOrderAdmin(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.billPayService.toGraph(await this.billPayService.adminFind(ctx, id));
    }

    @Query()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async billPayChannelConfig(@Ctx() ctx: RequestContext) {
        return this.billPayService.getRawChannelConfig(ctx);
    }

    @Query()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async merchantAgreements(@Ctx() ctx: RequestContext) {
        return this.billPayService.listAgreements(ctx);
    }

    @Mutation()
    @Transaction()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async updateBillPayQuote(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('quoteAmount') quoteAmount: number,
        @Args('note') note: string,
    ) {
        return this.billPayService.toGraph(
            await this.billPayService.updateBillPayQuote(ctx, id, quoteAmount, note),
        );
    }

    @Mutation()
    @Transaction()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async acceptBillPayOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.billPayService.toGraph(await this.billPayService.acceptBillPayOrder(ctx, id));
    }

    @Mutation()
    @Transaction()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async completeBillPayOrder(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('actualAmount') actualAmount: number,
        @Args('proofUrl') proofUrl: string,
        @Args('note', { nullable: true }) note?: string,
    ) {
        return this.billPayService.toGraph(
            await this.billPayService.completeBillPayOrder(ctx, id, actualAmount, proofUrl, note),
        );
    }

    @Mutation()
    @Transaction()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async settleBillPayOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.billPayService.toGraph(await this.billPayService.settleBillPayOrder(ctx, id));
    }

    @Mutation()
    @Transaction()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async refundBillPayOrder(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason', { nullable: true }) reason?: string,
    ) {
        return this.billPayService.toGraph(await this.billPayService.refundBillPayOrder(ctx, id, reason));
    }

    @Mutation()
    @Transaction()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async saveMerchantAgreement(
        @Ctx() ctx: RequestContext,
        @Args('input') input: {
            merchantName: string;
            merchantId?: string | number | null;
            settleRate: number;
            settleMode?: string;
            contact?: string;
            note?: string;
        },
        @Args('id', { nullable: true }) id?: ID,
    ) {
        return this.billPayService.saveAgreement(ctx, input, id);
    }

    @Mutation()
    @Transaction()
    @Allow(BillPayPermissions.BillPayManage as Permission)
    async saveBillPayChannelConfig(@Ctx() ctx: RequestContext, @Args('config') config: any) {
        return this.billPayService.saveChannelConfig(ctx, config);
    }
}
