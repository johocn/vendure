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
        @Args({ name: 'type', type: () => String, nullable: true }) type?: string | null,
        @Args({ name: 'orderCode', type: () => String, nullable: true }) orderCode?: string | null,
        @Args({ name: 'keyword', type: () => String, nullable: true }) keyword?: string | null,
        @Args({ name: 'tag', type: () => String, nullable: true }) tag?: string | null,
        @Args({ name: 'assignee', type: () => String, nullable: true }) assignee?: string | null,
        @Args({ name: 'from', type: () => String, nullable: true }) from?: string | null,
        @Args({ name: 'to', type: () => String, nullable: true }) to?: string | null,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number | null,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number | null,
    ) {
        return this.merchant.afterSalesList(ctx, state, { type, orderCode, keyword, tag, assignee, from, to, skip, take });
    }

    /** 售后详情（§81）：协商留言 + 状态时间线 + 退款失败留痕 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesDetail(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.merchant.afterSalesDetail(ctx, id);
    }

    /** 售后处理统计（§81）：待处理/超时/今日处理量/今日退款额 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesStats(@Ctx() ctx: RequestContext) {
        return this.merchant.afterSalesStats(ctx);
    }

    /** 售后报表（§83）：区间内量/退款/超时与逐日趋势（校园日 UTC+8） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesReport(
        @Ctx() ctx: RequestContext,
        @Args('from') from: string,
        @Args('to') to: string,
    ) {
        return this.merchant.afterSalesReport(ctx, from, to);
    }

    /** 售后寄回地址（§83）：本店渠道配置 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesReturnAddress(@Ctx() ctx: RequestContext) {
        return this.merchant.afterSalesReturnAddress(ctx);
    }

    /** 售后规则（§84）：处理时限/超时自动同意/退款自动重试 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesRules(@Ctx() ctx: RequestContext) {
        return this.merchant.afterSalesRules(ctx);
    }

    /** 退款流水（§84）：按退款时间倒序分页 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesRefunds(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'from', type: () => String, nullable: true }) from?: string | null,
        @Args({ name: 'to', type: () => String, nullable: true }) to?: string | null,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number | null,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number | null,
    ) {
        return this.merchant.afterSalesRefunds(ctx, { from, to, skip, take });
    }

    /** 售后自动化任务（§85）：本店超时/自动同意/退款重试任务 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesTasks(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string | null,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number | null,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number | null,
    ) {
        return this.merchant.afterSalesTasks(ctx, { status, skip, take });
    }

    /** 导出 CSV（§85）：kind=requests|refunds，前端保存为文件 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesExport(
        @Ctx() ctx: RequestContext,
        @Args('from') from: string,
        @Args('to') to: string,
        @Args('kind') kind: string,
    ) {
        return this.merchant.afterSalesExport(ctx, from, to, kind);
    }

    /** 高频售后顾客 Top N（§85） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesTopCustomers(
        @Ctx() ctx: RequestContext,
        @Args('from') from: string,
        @Args('to') to: string,
        @Args({ name: 'limit', type: () => Number, nullable: true }) limit?: number | null,
    ) {
        return this.merchant.afterSalesTopCustomers(ctx, from, to, limit);
    }

    /** 售后内部备注（§86）：仅本店可见 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesNotes(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.merchant.afterSalesNotes(ctx, id);
    }

    /** 快捷回复模板（§87）：本店渠道共用 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesReplyTemplates(@Ctx() ctx: RequestContext) {
        return this.merchant.afterSalesReplyTemplates(ctx);
    }

    /** 售后工作台摘要（§88） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesWorkbench(@Ctx() ctx: RequestContext) {
        return this.merchant.afterSalesWorkbench(ctx);
    }

    /** 售后标签列表（§88） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesTags(@Ctx() ctx: RequestContext) {
        return this.merchant.afterSalesTags(ctx);
    }

    /** 处理人候选（§89） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesAssignees(@Ctx() ctx: RequestContext) {
        return this.merchant.afterSalesAssignees(ctx);
    }

    /** 员工处理绩效（§89） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesStaffStats(
        @Ctx() ctx: RequestContext,
        @Args('from') from: string,
        @Args('to') to: string,
    ) {
        return this.merchant.afterSalesStaffStats(ctx, from, to);
    }

    /** 本店黑名单列表（§90） */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesBlacklist(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number | null,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number | null,
    ) {
        return this.merchant.afterSalesBlacklist(ctx, { skip, take });
    }

    /** 同意售后（§81）：仅退款单直接退款到账（链式 Received → Refunded）；顾客申诉单同样适用 */
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

    /** 商家协商留言（§81）：与顾客 C 端售后详情双向互通，Closed 后禁言 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesReply(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('content') content: string,
        @Args({ name: 'images', type: () => [String], nullable: true }) images?: string[] | null,
    ) {
        return this.merchant.afterSalesReply(ctx, id, content, images);
    }

    /** 商家确认收到退货（§82）：Returning → Received，可传实收数量与收货备注 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesConfirmReturn(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'receivedQuantity', type: () => Number, nullable: true }) receivedQuantity?: number | null,
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string | null,
    ) {
        return this.merchant.afterSalesConfirmReturn(ctx, id, receivedQuantity, note);
    }

    /** 售后退款失败重试（§82）：仅 RefundFailed，30 秒内同单一次 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesRetryRefund(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.merchant.afterSalesRetryRefund(ctx, id);
    }

    /** 换货发货（§83）：Received → ExchangeShipped，仅换货单 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesExchangeShip(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('trackingNo') trackingNo: string,
        @Args({ name: 'carrier', type: () => String, nullable: true }) carrier?: string | null,
    ) {
        return this.merchant.afterSalesExchangeShip(ctx, id, trackingNo, carrier);
    }

    /** 批量同意（§83）：单次最多 50 条，逐单返回结果 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesBatchApprove(@Ctx() ctx: RequestContext, @Args('ids') ids: ID[]) {
        return this.merchant.afterSalesBatchApprove(ctx, ids);
    }

    /** 批量驳回（§83）：整批共用一个原因，单次最多 50 条 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesBatchReject(
        @Ctx() ctx: RequestContext,
        @Args('ids') ids: ID[],
        @Args('reason') reason: string,
    ) {
        return this.merchant.afterSalesBatchReject(ctx, ids, reason);
    }

    /** 保存售后寄回地址（§83） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantUpdateAfterSalesReturnAddress(
        @Ctx() ctx: RequestContext,
        @Args('address') address: string,
    ) {
        return this.merchant.updateAfterSalesReturnAddress(ctx, address);
    }

    /** 保存售后规则（§84）：只写传入项，保留其它渠道字段 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantUpdateAfterSalesRules(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'timeoutHours', type: () => Number, nullable: true }) timeoutHours?: number | null,
        @Args({ name: 'autoApproveHours', type: () => Number, nullable: true }) autoApproveHours?: number | null,
        @Args({ name: 'refundAutoRetry', type: () => Number, nullable: true }) refundAutoRetry?: number | null,
        @Args({ name: 'firstResponseTargetHours', type: () => Number, nullable: true }) firstResponseTargetHours?: number | null,
        @Args({ name: 'resolveTargetHours', type: () => Number, nullable: true }) resolveTargetHours?: number | null,
        @Args({ name: 'dueSoonHours', type: () => Number, nullable: true }) dueSoonHours?: number | null,
    ) {
        return this.merchant.updateAfterSalesRules(ctx, {
            timeoutHours,
            autoApproveHours,
            refundAutoRetry,
            firstResponseTargetHours,
            resolveTargetHours,
            dueSoonHours,
        });
    }

    /** 商家关闭待处理售后（§84）：Pending → Closed，原因必填并回显顾客 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesClose(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason') reason: string,
    ) {
        return this.merchant.afterSalesClose(ctx, id, reason);
    }

    /** 商家催办顾客（§84）：60 秒内同单一次 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesRemind(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string | null,
    ) {
        return this.merchant.afterSalesRemind(ctx, id, note);
    }

    /** 立即执行售后自动化任务（§85） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesRunTask(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.merchant.afterSalesRunTask(ctx, id);
    }

    /** 一键拉黑高频售后顾客（§85） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantBlacklistAfterSalesCustomer(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args({ name: 'reason', type: () => String, nullable: true }) reason?: string | null,
    ) {
        return this.merchant.blacklistAfterSalesCustomer(ctx, customerId, reason);
    }

    /** 新增售后内部备注（§86）：顾客不可见 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesAddNote(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('content') content: string,
    ) {
        return this.merchant.addAfterSalesNote(ctx, id, content);
    }

    /** 删除售后内部备注（§86） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesDeleteNote(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('noteId') noteId: ID,
    ) {
        return this.merchant.deleteAfterSalesNote(ctx, id, noteId);
    }

    /** 批量催办顾客（§86）：单次最多 20 条 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesBatchRemind(
        @Ctx() ctx: RequestContext,
        @Args('ids') ids: ID[],
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string | null,
    ) {
        return this.merchant.afterSalesBatchRemind(ctx, ids, note);
    }

    /** 保存快捷回复模板（§87）：id 为空=新增 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSaveAfterSalesReplyTemplate(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'id', type: () => String, nullable: true }) id: ID | null,
        @Args('content') content: string,
    ) {
        return this.merchant.saveAfterSalesReplyTemplate(ctx, id, content);
    }

    /** 删除快捷回复模板（§87） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantDeleteAfterSalesReplyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.merchant.deleteAfterSalesReplyTemplate(ctx, id);
    }

    /** 手动排程退款重试（§87）：仅 RefundFailed */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesScheduleRefundRetry(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.merchant.afterSalesScheduleRefundRetry(ctx, id);
    }

    /** 保存售后标签（§88）：id 为空=新增 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSaveAfterSalesTag(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'id', type: () => String, nullable: true }) id: ID | null,
        @Args('name') name: string,
    ) {
        return this.merchant.saveAfterSalesTag(ctx, id, name);
    }

    /** 删除售后标签（§88） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantDeleteAfterSalesTag(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.merchant.deleteAfterSalesTag(ctx, id);
    }

    /** 设置售后单标签（§88）：整体替换 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantSetAfterSalesTags(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'tagIds', type: () => [String] }) tagIds: ID[],
    ) {
        return this.merchant.setAfterSalesTags(ctx, id, tagIds);
    }

    /** 指派处理人（§89）：userId 为空=取消指派 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesAssign(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'userId', type: () => String, nullable: true }) userId: ID | null,
    ) {
        return this.merchant.afterSalesAssign(ctx, id, userId);
    }

    /** 批量打标签（§89） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesBatchTag(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'ids', type: () => [String] }) ids: ID[],
        @Args({ name: 'tagIds', type: () => [String] }) tagIds: ID[],
    ) {
        return this.merchant.afterSalesBatchTag(ctx, ids, tagIds);
    }

    /** 解除本店顾客拉黑（§89） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantUnblacklistAfterSalesCustomer(@Ctx() ctx: RequestContext, @Args('customerId') customerId: ID) {
        return this.merchant.unblacklistAfterSalesCustomer(ctx, customerId);
    }

    /** 批量指派处理人（§90）：userId 为空=批量取消 */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesBatchAssign(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'ids', type: () => [String] }) ids: ID[],
        @Args({ name: 'userId', type: () => String, nullable: true }) userId: ID | null,
    ) {
        return this.merchant.afterSalesBatchAssign(ctx, ids, userId);
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
