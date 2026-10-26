import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { CampusPermissions } from './permissions';
import { MerchantAdminService } from './merchant-admin.service';

@Resolver()
export class MerchantAdminResolver {
    constructor(private merchant: MerchantAdminService) {}

    /** 商家接单工作台看板：本渠道待接单/备餐中/待取货/配送中 + 今日完成 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantBoard(@Ctx() ctx: RequestContext) {
        return this.merchant.board(ctx);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAcceptOrder(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.acceptOrder(ctx, orderId);
    }

    /** 商家侧顾客联系方式（号码保护）：开启后仅返回脱敏/虚拟号 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantCustomerContact(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.customerContact(ctx, orderId);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantCookingDone(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.cookingDone(ctx, orderId);
    }

    /** 商家拒单/缺货：全额退款并取消订单（接单前或备餐中可用） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantRejectOrder(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('reason') reason: string,
    ) {
        return this.merchant.rejectOrder(ctx, orderId, reason);
    }

    /** 营业中开关（本渠道 paused） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetPaused(@Ctx() ctx: RequestContext, @Args('paused') paused: boolean) {
        return this.merchant.setPaused(ctx, paused);
    }

    /** 小票打印回执：打印成功后回写 waimaiPrintedAt（防重打 + 补打依据） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantMarkPrinted(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.markPrinted(ctx, orderId);
    }

    /** 一键沽清：本店商品列表（含售罄标记） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantProducts(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'search', type: () => String, nullable: true }) search?: string,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.merchant.products(ctx, search, skip, take);
    }

    /** 沽清 / 取消沽清（售罄仍展示、不可加购） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetProductSoldOut(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
        @Args('soldOut') soldOut: boolean,
    ) {
        return this.merchant.setProductSoldOut(ctx, productId, soldOut);
    }

    /** 推送外部快递：provider = dada | meituan（由运营中心在派单时选择） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantDispatchExternal(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('provider') provider: string,
    ) {
        return this.merchant.dispatchExternal(ctx, orderId, provider as any);
    }

    /** 取消外部快递（改推另一家前先取消，或运力失败回落） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantCancelExternal(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args({ name: 'reason', type: () => String, nullable: true }) reason?: string,
    ) {
        return this.merchant.cancelExternal(ctx, orderId, reason);
    }

    /** 自营快递接单（R1 商户超时转自营 / R3 自营池） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAcceptOwned(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.acceptOwned(ctx, orderId);
    }

    /** R1：商户送达校园交接点（之后由传信者接力） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantMarkHandoverArrived(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.markHandoverArrived(ctx, orderId);
    }

    /** 自营快递送达：R1/R2 到交接点，R3 到学生 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantMarkOwnedArrived(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.markOwnedArrived(ctx, orderId);
    }
}
