import { ID, RequestContext } from '@vendure/core';
import { MerchantAdminService } from './merchant-admin.service';
export declare class MerchantAdminResolver {
    private merchant;
    constructor(merchant: MerchantAdminService);
    /** 商家接单工作台看板：本渠道待接单/备餐中/待取货/配送中 + 今日完成 */
    campusMerchantBoard(ctx: RequestContext): Promise<import("./merchant-admin.service").MerchantBoard>;
    /** 商家自助经营：门店资料（营业时间/公告/电话/营业状态） */
    campusMerchantStoreProfile(ctx: RequestContext): Promise<import("./merchant-admin.service").MerchantStoreProfile>;
    /** 今日/区间已完成订单明细（§75 对账）：送达口径与工作台「今日完成」一致 */
    campusMerchantCompletedOrders(ctx: RequestContext, from?: string | null, to?: string | null, take?: number | null, skip?: number | null): Promise<import("./merchant-admin.service").MerchantCompletedOrders>;
    /** 退款记录台账（§77）：区间内本店退款单，含失败单留痕与汇总 */
    campusMerchantRefunds(ctx: RequestContext, from?: string | null, to?: string | null, take?: number | null, skip?: number | null): Promise<import("./merchant-admin.service").MerchantRefundList>;
    /** 商家自助修改门店资料：只改本渠道，营业时间写入 Channel 自定义字段 */
    campusMerchantUpdateStore(ctx: RequestContext, businessHours?: string | null, storeNotice?: string | null, storePhone?: string | null): Promise<import("./merchant-admin.service").MerchantStoreProfile>;
    /** 营业日历（§70）：整体替换休业日期列表，当天 C 端「今日休业」并拦截下单。
     * dates 入参为 JSON 字符串：[{date:'YYYY-MM-DD', note?}]，空/[]=关闭；非法条目由服务层拒绝。 */
    campusMerchantSetClosureDates(ctx: RequestContext, dates?: string | null): Promise<import("./merchant-admin.service").MerchantStoreProfile>;
    /** 经营数据：今日/近 7 日单量、营业额、客单价、取消退款 */
    campusMerchantRevenue(ctx: RequestContext): Promise<import("./merchant-admin.service").MerchantRevenue>;
    campusMerchantAcceptOrder(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 商家侧顾客联系方式（号码保护）：开启后仅返回脱敏/虚拟号 */
    campusMerchantCustomerContact(ctx: RequestContext, orderId: ID): Promise<import("./privacy-number.service").PrivacyContact>;
    campusMerchantCookingDone(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 工作台批量接单（§73）：多选订单一次接单，逐单走既有状态机，失败单跳过并回报 */
    campusMerchantBatchAcceptOrders(ctx: RequestContext, orderIds: string[]): Promise<import("./batch-orders").BatchOrderResult>;
    /** 工作台批量出餐（§73）：多选备餐中订单一次出餐，失败单跳过并回报 */
    campusMerchantBatchCookingDoneOrders(ctx: RequestContext, orderIds: string[]): Promise<import("./batch-orders").BatchOrderResult>;
    /** 商家拒单/缺货：全额退款并取消订单（接单前或备餐中可用） */
    campusMerchantRejectOrder(ctx: RequestContext, orderId: ID, reason: string): Promise<{
        ok: boolean;
    }>;
    /** 商家发起退款（§76）：已送达订单整单/部分退款，金额为分；返回本次退款与剩余可退 */
    campusMerchantRefundOrder(ctx: RequestContext, orderId: ID, amount: number, reason: string): Promise<import("./merchant-admin.service").MerchantRefundResult>;
    /** 营业中开关（本渠道 paused） */
    campusMerchantSetPaused(ctx: RequestContext, paused: boolean): Promise<{
        ok: boolean;
    }>;
    /** 小票打印回执：打印成功后回写 waimaiPrintedAt（防重打 + 补打依据） */
    campusMerchantMarkPrinted(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 顾客催单「已知晓」（§78）：商家确认后工作台/出餐屏解除催单提醒 */
    campusMerchantAckUrge(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** KDS 出餐屏（P1-4）：待接单/备餐中队列，按等待时长分级 */
    campusMerchantKitchenQueue(ctx: RequestContext): Promise<import("./merchant-admin.service").KitchenQueue>;
    /** 备餐汇总（§79）：今日商品份数聚合，后厨按份备料/核对出餐 */
    campusMerchantPrepSummary(ctx: RequestContext): Promise<import("./merchant-admin.service").MerchantPrepItem[]>;
    /** 营业日报（§80）：单日 KPI + 时段分布 + 商品 Top5 + 对比昨日/近 7 日均值 */
    campusMerchantDailyReport(ctx: RequestContext, date?: string | null): Promise<import("./merchant-admin.service").MerchantDailyReport>;
    /** 售后申请清单（§81）：本店渠道订单的售后单；state 为空=全部，Pending=待处理 */
    campusMerchantAfterSales(ctx: RequestContext, state?: string | null, type?: string | null, orderCode?: string | null, from?: string | null, to?: string | null, skip?: number | null, take?: number | null): Promise<import("./merchant-admin.service").MerchantAfterSalesList>;
    /** 售后详情（§81）：协商留言 + 状态时间线 + 退款失败留痕 */
    campusMerchantAfterSalesDetail(ctx: RequestContext, id: ID): Promise<import("./merchant-admin.service").MerchantAfterSalesDetail>;
    /** 售后处理统计（§81）：待处理/超时/今日处理量/今日退款额 */
    campusMerchantAfterSalesStats(ctx: RequestContext): Promise<import("./merchant-admin.service").MerchantAfterSalesStats>;
    /** 售后报表（§83）：区间内量/退款/超时与逐日趋势（校园日 UTC+8） */
    campusMerchantAfterSalesReport(ctx: RequestContext, from: string, to: string): Promise<import("./merchant-admin.service").MerchantAfterSalesReport>;
    /** 售后寄回地址（§83）：本店渠道配置 */
    campusMerchantAfterSalesReturnAddress(ctx: RequestContext): Promise<string>;
    /** 同意售后（§81）：仅退款单直接退款到账（链式 Received → Refunded）；顾客申诉单同样适用 */
    campusMerchantAfterSalesApprove(ctx: RequestContext, id: ID): Promise<import("./merchant-admin.service").MerchantAfterSalesRow>;
    /** 驳回售后（§81）：reason 必填，顾客在 C 端可见并可在售后详情里申诉 */
    campusMerchantAfterSalesReject(ctx: RequestContext, id: ID, reason: string): Promise<import("./merchant-admin.service").MerchantAfterSalesRow>;
    /** 商家协商留言（§81）：与顾客 C 端售后详情双向互通，Closed 后禁言 */
    campusMerchantAfterSalesReply(ctx: RequestContext, id: ID, content: string, images?: string[] | null): Promise<import("./merchant-admin.service").MerchantAfterSalesMessage>;
    /** 商家确认收到退货（§82）：Returning → Received，可传实收数量与收货备注 */
    campusMerchantAfterSalesConfirmReturn(ctx: RequestContext, id: ID, receivedQuantity?: number | null, note?: string | null): Promise<import("./merchant-admin.service").MerchantAfterSalesRow>;
    /** 售后退款失败重试（§82）：仅 RefundFailed，30 秒内同单一次 */
    campusMerchantAfterSalesRetryRefund(ctx: RequestContext, id: ID): Promise<import("./merchant-admin.service").MerchantAfterSalesRow>;
    /** 换货发货（§83）：Received → ExchangeShipped，仅换货单 */
    campusMerchantAfterSalesExchangeShip(ctx: RequestContext, id: ID, trackingNo: string, carrier?: string | null): Promise<import("./merchant-admin.service").MerchantAfterSalesRow>;
    /** 批量同意（§83）：单次最多 50 条，逐单返回结果 */
    campusMerchantAfterSalesBatchApprove(ctx: RequestContext, ids: ID[]): Promise<import("./merchant-admin.service").MerchantAfterSalesBatchResult[]>;
    /** 批量驳回（§83）：整批共用一个原因，单次最多 50 条 */
    campusMerchantAfterSalesBatchReject(ctx: RequestContext, ids: ID[], reason: string): Promise<import("./merchant-admin.service").MerchantAfterSalesBatchResult[]>;
    /** 保存售后寄回地址（§83） */
    campusMerchantUpdateAfterSalesReturnAddress(ctx: RequestContext, address: string): Promise<boolean>;
    /** 云打印：后端签名直连服务商，成功后回写小票打印时间 */
    campusMerchantCloudPrint(ctx: RequestContext, orderId: ID): Promise<import("./cloud-print.service").CloudPrintResult>;
    /** 云打印连通性测试（不占用订单） */
    campusMerchantCloudPrintTest(ctx: RequestContext): Promise<import("./cloud-print.service").CloudPrintResult>;
    /** 最近云打印任务（后台排障：失败原因/耗时） */
    campusMerchantPrintJobs(ctx: RequestContext, limit?: number): Promise<import("./cloud-print.service").CloudPrintJobRow[]>;
    /** 一键沽清：本店商品列表（含售罄标记） */
    campusMerchantProducts(ctx: RequestContext, search?: string, skip?: number, take?: number): Promise<{
        items: any;
        total: number;
    }>;
    /** 沽清 / 取消沽清（售罄仍展示、不可加购） */
    campusMerchantSetProductSoldOut(ctx: RequestContext, productId: ID, soldOut: boolean): Promise<{
        ok: boolean;
        soldOut: boolean;
    }>;
    /** 全店批量沽清 / 批量恢复（打烊场景一步到位） */
    campusMerchantSetAllProductsSoldOut(ctx: RequestContext, soldOut: boolean): Promise<{
        ok: boolean;
        soldOut: boolean;
        count: number;
    }>;
    /** 沽清次日自动恢复：查询开关与待恢复件数 */
    campusMerchantSoldOutAutoRestore(ctx: RequestContext): Promise<{
        enabled: boolean;
        pending: number;
    }>;
    /** 沽清次日自动恢复：开关 */
    campusMerchantSetSoldOutAutoRestore(ctx: RequestContext, enabled: boolean): Promise<{
        enabled: boolean;
        pending: number;
    }>;
    /** 商家自动接单设置（§69）：开关 / 延迟秒数 / 每日上限 / 适用范围路线 */
    campusMerchantAutoAccept(ctx: RequestContext): Promise<{
        enabled: boolean;
        delaySeconds: number;
        dailyLimit: number;
        routes: string[];
        acceptedToday: number;
        openNow: boolean;
        merchantConfirmEnabled: boolean;
    }>;
    /** 保存自动接单设置；营业中且未暂停才会生效，超每日上限退回人工接单 */
    campusMerchantUpdateAutoAccept(ctx: RequestContext, enabled: boolean, delaySeconds?: number | null, dailyLimit?: number | null, routes?: string[] | null): Promise<{
        enabled: boolean;
        delaySeconds: number;
        dailyLimit: number;
        routes: string[];
        acceptedToday: number;
        openNow: boolean;
        merchantConfirmEnabled: boolean;
    }>;
    /** 商品级打包费（分/件）：null 清除回落店铺配置 */
    campusMerchantSetProductPackingFee(ctx: RequestContext, productId: ID, packingFee?: number | null): Promise<{
        ok: boolean;
        packingFee: number | null;
    }>;
    /** 每日限量 / 每人限购（§68）：传 null 或 0 = 不限 */
    campusMerchantSetProductLimit(ctx: RequestContext, productId: ID, dailyLimit?: number | null, perUserLimit?: number | null): Promise<{
        ok: boolean;
        dailyLimit: number | null;
        perUserLimit: number | null;
        soldToday: number;
        remaining: number | null;
    }>;
    /** 商品加料组（P1-2）：传空数组清除 */
    campusMerchantSetProductAddonGroups(ctx: RequestContext, productId: ID, groups: string[]): Promise<{
        ok: boolean;
        addonGroups: string | null;
    }>;
    /** 商品套餐内容（P1-2）：传 null 清除 */
    campusMerchantSetProductCombo(ctx: RequestContext, productId: ID, combo?: string | null): Promise<{
        ok: boolean;
        combo: string | null;
    }>;
    /** 推送外部快递：provider = dada | meituan（由运营中心在派单时选择） */
    campusMerchantDispatchExternal(ctx: RequestContext, orderId: ID, provider: string): Promise<{
        ok: boolean;
        already: boolean;
        thirdPartyNo: any;
        provider?: undefined;
    } | {
        ok: boolean;
        thirdPartyNo: any;
        provider: import("./route-matrix").ExternalProviderCode;
        already?: undefined;
    }>;
    /** 取消外部快递（改推另一家前先取消，或运力失败回落） */
    campusMerchantCancelExternal(ctx: RequestContext, orderId: ID, reason?: string): Promise<{
        ok: boolean;
        skipped: boolean;
        reason?: undefined;
    } | {
        ok: boolean;
        reason: string | undefined;
        skipped?: undefined;
    }>;
    /** 自营快递接单（R1 商户超时转自营 / R3 自营池） */
    campusMerchantAcceptOwned(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** R1：商户送达校园交接点（之后由传信者接力） */
    campusMerchantMarkHandoverArrived(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
        done: boolean;
    }>;
    /** 自营快递送达：R1/R2 到交接点，R3 到学生 */
    campusMerchantMarkOwnedArrived(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
        done: boolean;
    }>;
}
