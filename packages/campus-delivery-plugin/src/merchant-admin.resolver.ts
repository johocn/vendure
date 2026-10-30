import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext, UserInputError } from '@vendure/core';
import { CampusPermissions } from './permissions';
import { MerchantAdminService } from './merchant-admin.service';

/** JSON 字符串入参解析：语法错误直接以 UserInputError 反馈给后台，避免落库脏数据 */
function parseJson(raw: string): any {
    try {
        return JSON.parse(raw);
    } catch {
        throw new UserInputError('配置格式不合法（JSON 解析失败）');
    }
}

/** 逐条解析 JSON 字符串数组（空元素跳过） */
function parseJsonList(raw: string[]): any[] {
    return (raw ?? []).filter(s => String(s ?? '').trim() !== '').map(s => parseJson(String(s)));
}

@Resolver()
export class MerchantAdminResolver {
    constructor(private merchant: MerchantAdminService) {}

    /** 商家接单工作台看板：本渠道待接单/备餐中/待取货/配送中 + 今日完成 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantBoard(@Ctx() ctx: RequestContext) {
        return this.merchant.board(ctx);
    }

    /** 商家自助经营：门店资料（营业时间/公告/电话/营业状态） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantStoreProfile(@Ctx() ctx: RequestContext) {
        return this.merchant.storeProfile(ctx);
    }

    /** 今日/区间已完成订单明细（§75 对账）：送达口径与工作台「今日完成」一致 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantCompletedOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'from', type: () => String, nullable: true }) from?: string | null,
        @Args({ name: 'to', type: () => String, nullable: true }) to?: string | null,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number | null,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number | null,
    ) {
        return this.merchant.completedOrders(ctx, { from, to, take, skip });
    }

    /** 退款记录台账（§77）：区间内本店退款单，含失败单留痕与汇总 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantRefunds(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'from', type: () => String, nullable: true }) from?: string | null,
        @Args({ name: 'to', type: () => String, nullable: true }) to?: string | null,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number | null,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number | null,
    ) {
        return this.merchant.refunds(ctx, { from, to, take, skip });
    }

    /** 商家自助修改门店资料：只改本渠道，营业时间写入 Channel 自定义字段 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantUpdateStore(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'businessHours', type: () => String, nullable: true }) businessHours?: string | null,
        @Args({ name: 'storeNotice', type: () => String, nullable: true }) storeNotice?: string | null,
        @Args({ name: 'storePhone', type: () => String, nullable: true }) storePhone?: string | null,
    ) {
        return this.merchant.updateStore(ctx, { businessHours, storeNotice, storePhone });
    }

    /** 营业日历（§70）：整体替换休业日期列表，当天 C 端「今日休业」并拦截下单。
     * dates 入参为 JSON 字符串：[{date:'YYYY-MM-DD', note?}]，空/[]=关闭；非法条目由服务层拒绝。 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetClosureDates(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'dates', type: () => String, nullable: true }) dates?: string | null,
    ) {
        const parsed = dates ? parseJson(String(dates)) : [];
        if (!Array.isArray(parsed)) throw new UserInputError('休业日历必须是日期数组');
        return this.merchant.updateClosureDates(ctx, parsed);
    }

    /** 经营数据：今日/近 7 日单量、营业额、客单价、取消退款 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantRevenue(@Ctx() ctx: RequestContext) {
        return this.merchant.revenue(ctx);
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

    /** 工作台批量接单（§73）：多选订单一次接单，逐单走既有状态机，失败单跳过并回报 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantBatchAcceptOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'orderIds', type: () => [String] }) orderIds: string[],
    ) {
        return this.merchant.batchAcceptOrders(ctx, orderIds);
    }

    /** 工作台批量出餐（§73）：多选备餐中订单一次出餐，失败单跳过并回报 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantBatchCookingDoneOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'orderIds', type: () => [String] }) orderIds: string[],
    ) {
        return this.merchant.batchCookingDone(ctx, orderIds);
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

    /** 商家发起退款（§76）：已送达订单整单/部分退款，金额为分；返回本次退款与剩余可退 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantRefundOrder(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('amount') amount: number,
        @Args('reason') reason: string,
    ) {
        return this.merchant.merchantRefund(ctx, orderId, amount, reason);
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

    /** 顾客催单「已知晓」（§78）：商家确认后工作台/出餐屏解除催单提醒 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAckUrge(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.ackUrge(ctx, orderId);
    }

    /** KDS 出餐屏（P1-4）：待接单/备餐中队列，按等待时长分级 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantKitchenQueue(@Ctx() ctx: RequestContext) {
        return this.merchant.kitchenQueue(ctx);
    }

    /** 备餐汇总（§79）：今日商品份数聚合，后厨按份备料/核对出餐 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantPrepSummary(@Ctx() ctx: RequestContext) {
        return this.merchant.prepSummary(ctx);
    }

    /** 营业日报（§80）：单日 KPI + 时段分布 + 商品 Top5 + 对比昨日/近 7 日均值 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantDailyReport(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'date', type: () => String, nullable: true }) date?: string | null,
    ) {
        return this.merchant.dailyReport(ctx, date);
    }

    /** 售后申请清单（§81）：本店渠道订单的售后单；state 为空=全部，Pending=待处理 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSales(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'state', type: () => String, nullable: true }) state?: string | null,
    ) {
        return this.merchant.afterSalesList(ctx, state);
    }

    /** 同意售后（§81）：仅退款单直接退款到账（链式 Received → Refunded） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesApprove(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.merchant.afterSalesApprove(ctx, id);
    }

    /** 驳回售后（§81）：reason 必填，顾客在 C 端可见并可在售后详情里申诉 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesReject(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason') reason: string,
    ) {
        return this.merchant.afterSalesReject(ctx, id, reason);
    }

    /** 云打印：后端签名直连服务商，成功后回写小票打印时间 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantCloudPrint(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.merchant.cloudPrint(ctx, orderId);
    }

    /** 云打印连通性测试（不占用订单） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantCloudPrintTest(@Ctx() ctx: RequestContext) {
        return this.merchant.cloudPrintTest(ctx);
    }

    /** 最近云打印任务（后台排障：失败原因/耗时） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantPrintJobs(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'limit', type: () => Number, nullable: true }) limit?: number,
    ) {
        return this.merchant.printJobs(ctx, limit);
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

    /** 全店批量沽清 / 批量恢复（打烊场景一步到位） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetAllProductsSoldOut(
        @Ctx() ctx: RequestContext,
        @Args('soldOut') soldOut: boolean,
    ) {
        return this.merchant.setAllProductsSoldOut(ctx, soldOut);
    }

    /** 沽清次日自动恢复：查询开关与待恢复件数 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSoldOutAutoRestore(@Ctx() ctx: RequestContext) {
        return this.merchant.getSoldOutAutoRestore(ctx);
    }

    /** 沽清次日自动恢复：开关 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetSoldOutAutoRestore(
        @Ctx() ctx: RequestContext,
        @Args('enabled') enabled: boolean,
    ) {
        return this.merchant.setSoldOutAutoRestore(ctx, enabled);
    }

    /** 商家自动接单设置（§69）：开关 / 延迟秒数 / 每日上限 / 适用范围路线 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAutoAccept(@Ctx() ctx: RequestContext) {
        return this.merchant.autoAcceptSettings(ctx);
    }

    /** 保存自动接单设置；营业中且未暂停才会生效，超每日上限退回人工接单 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantUpdateAutoAccept(
        @Ctx() ctx: RequestContext,
        @Args('enabled') enabled: boolean,
        @Args({ name: 'delaySeconds', type: () => Number, nullable: true }) delaySeconds?: number | null,
        @Args({ name: 'dailyLimit', type: () => Number, nullable: true }) dailyLimit?: number | null,
        @Args({ name: 'routes', type: () => [String], nullable: true }) routes?: string[] | null,
    ) {
        return this.merchant.updateAutoAccept(ctx, { enabled, delaySeconds, dailyLimit, routes });
    }

    /** 商品级打包费（分/件）：null 清除回落店铺配置 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetProductPackingFee(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
        @Args({ name: 'packingFee', type: () => Number, nullable: true }) packingFee?: number | null,
    ) {
        return this.merchant.setProductPackingFee(ctx, productId, packingFee ?? null);
    }

    /** 每日限量 / 每人限购（§68）：传 null 或 0 = 不限 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetProductLimit(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
        @Args({ name: 'dailyLimit', type: () => Number, nullable: true }) dailyLimit?: number | null,
        @Args({ name: 'perUserLimit', type: () => Number, nullable: true }) perUserLimit?: number | null,
    ) {
        return this.merchant.setProductLimit(ctx, productId, dailyLimit ?? null, perUserLimit ?? null);
    }

    /** 商品加料组（P1-2）：传空数组清除 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetProductAddonGroups(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
        @Args({ name: 'groups', type: () => [String] }) groups: string[],
    ) {
        return this.merchant.setProductAddonGroups(ctx, productId, parseJsonList(groups));
    }

    /** 商品套餐内容（P1-2）：传 null 清除 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetProductCombo(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
        @Args({ name: 'combo', type: () => String, nullable: true }) combo?: string | null,
    ) {
        return this.merchant.setProductCombo(ctx, productId, combo ? parseJson(combo) : null);
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
