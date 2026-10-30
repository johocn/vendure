import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    Channel,
    ID,
    Injector,
    Logger,
    Order,
    OrderService,
    Product,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { AfterSalesRequest, AfterSalesService } from '@vendure/after-sales-plugin';
import { CampusBuilding } from './campus-building.entity';
import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { campusDayKey, campusHour, startOfCampusDay } from './campus-time';
import { BusinessTransition, isWithinBusinessHours, nextBusinessTransition, parseBusinessHours } from './business-hours';
import { ExternalProviderCode } from './route-matrix';
import { HallService } from './hall.service';
import { refundablePayments, settleRefundOrMarkFailed } from './refund-payment';
import { ThirdPartyDeliveryService } from './third-party-delivery.service';
import { normalizePrintMode } from './waimai-store.service';
import { CloudPrintService } from './cloud-print.service';
import { PrivacyNumberService } from './privacy-number.service';
import {
    serializeAddonGroups,
    serializeCombo,
    parseAddonGroups,
    parseCombo,
    addonDisplayText,
    ADDON_MAX_GROUPS,
    ADDON_MAX_OPTIONS_PER_GROUP,
    ADDON_MAX_PRICE_FEN,
    COMBO_MAX_ITEMS,
} from './addon-fee';
import { DAILY_LIMIT_MAX, normalizeLimit, queryDailySold, remainingOf } from './daily-limit';
import { AUTO_ACCEPT_DEFAULT_DELAY_SECONDS, normalizeAutoAcceptRoutes } from './auto-accept';
import { ClosureDate, closedToday, safeClosureDates } from './closure-calendar';
import { BatchOrderInputError, BatchOrderResult, normalizeBatchOrderIds } from './batch-orders';

/** 需商家处理的状态：Pending=待审批 / Appealed=顾客申诉（商家可再次同意） */
const AFTER_SALES_PENDING_STATES = ['Pending', 'Appealed'];

export interface MerchantBoardLine {
    name: string;
    quantity: number;
    price: number;
}

export interface MerchantBoardOrder {
    id: string;
    code: string;
    createdAt: Date;
    total: number;
    shipping: number;
    building: string;
    zone: string;
    slotText: string;
    route: string;
    riderName: string | null;
    note: string | null; // 顾客整单备注（工作台展示 + 小票打印）
    printedAt: Date | null; // 小票最近打印时间（null=未打）
    provider: string | null; // 外部快递：dada / meituan（运营中心派单后写入）
    thirdPartyNo: string | null; // 外部快递平台单号
    handoverCode: string | null; // 交接码（第一段送达交接点后生成，骑手取货时核对）
    /** 顾客手机号（脱敏，与号码保护同口径）：工作台检索用，不返回明文 */
    customerPhone: string | null;
    /** 顾客催单待处理（§78）：顾客催过且商家尚未「已知晓」 */
    urged: boolean;
    /** 顾客最近一次催单时间（null=从未催单） */
    urgedAt: Date | null;
    lines: MerchantBoardLine[];
}

/** 今日已完成订单明细（§75）：商家对账用，含退款与实收 */
export interface MerchantCompletedOrder {
    id: string;
    code: string;
    /** 送达时间（对账归时点；历史脏数据可能为 null） */
    deliveredAt: Date | null;
    createdAt: Date;
    /** 订单总额（与工作台「今日完成金额」同口径） */
    total: number;
    /** 该单已退金额（排除 Failed 退款单） */
    refundAmount: number;
    /** 实收 = total - refundAmount */
    netAmount: number;
    /** 剩余可退金额（分，§76）：已支付 − 已退；0 = 已全额退款或未支付 */
    refundable: number;
    building: string;
    zone: string;
    route: string;
    riderName: string | null;
    /** 顾客手机号（脱敏，号码保护同口径） */
    customerPhone: string | null;
    /** 商品摘要：宫保鸡丁×1、米饭×2 */
    lineText: string;
    note: string | null;
}

/** 已完成订单列表 + 区间汇总（§75 对账） */
export interface MerchantCompletedOrders {
    items: MerchantCompletedOrder[];
    /** 区间内已完成单量（不受分页影响） */
    total: number;
    /** 区间内订单总额 */
    totalAmount: number;
    /** 区间内退款总额 */
    refundAmount: number;
    /** 区间内实收总额 */
    netAmount: number;
    /** 客单价 = 实收 / 单量（取整） */
    avgTicket: number;
    /** 实际查询区间（回显给前端） */
    start: Date;
    end: Date;
}

/** 商家发起退款回执（§76） */
export interface MerchantRefundResult {
    ok: boolean;
    /** 本次退款金额（分） */
    amount: number;
    /** 该单累计已退（分，排除 Failed 退款单） */
    refundedTotal: number;
    /** 处理后剩余可退（分） */
    refundable: number;
}

/** 退款记录行（§77 台账）：一笔退款单一行，金额单位分 */
export interface MerchantRefundRow {
    id: string;
    orderId: string;
    code: string;
    /** 退款金额（分） */
    amount: number;
    /** 退款单状态（Pending/Settled/Failed…） */
    state: string;
    /** 退款原因（已去掉「merchant refund (单号):」留痕前缀） */
    reason: string;
    /** merchant=商家发起 / platform=平台处置（拒单、异常处置、无人接单等） */
    source: string;
    createdAt: Date;
    building: string;
    zone: string;
}

/** 退款记录台账 + 区间汇总（§77）：汇总不受分页影响 */
export interface MerchantRefundList {
    items: MerchantRefundRow[];
    /** 区间退款笔数（排除 Failed） */
    count: number;
    /** 区间退款总额（分，排除 Failed） */
    amount: number;
    /** 失败笔数 / 金额（留痕排障用，不计入退款总额） */
    failedCount: number;
    failedAmount: number;
    /** 区间退款单总数（含失败，用于分页） */
    total: number;
    /** 实际查询区间（回显给前端） */
    start: Date;
    end: Date;
}

/** 售后申请行（§81 商家端处理）：金额单位分，顾客可见字段原样回传给商家 */
export interface MerchantAfterSalesRow {
    id: string;
    orderId: string;
    /** 订单号（A2400xxx） */
    orderCode: string;
    /** 售后单状态（Pending/Approved/Rejected/Refunded/RefundFailed/Appealed/Closed…） */
    state: string;
    /** 售后类型（refund_only 仅退款 / return_refund 退货退款 / exchange 换货） */
    type: string;
    /** 顾客选择的售后原因 */
    reason: string;
    /** 顾客补充说明 */
    description: string | null;
    /** 申请退款金额（分） */
    refundAmount: number;
    /** 商家驳回理由（顾客可见） */
    rejectReason: string | null;
    evidenceImages: string[];
    /** 协商留言条数 */
    messageCount: number;
    /** 顾客姓名 */
    customerName: string | null;
    createdAt: Date;
    /** 退款到账时间（未退款为 null） */
    refundedAt: Date | null;
    /** 待处理且已超过渠道处理时限（超时阈值见售后插件 afterSalesTimeoutHours） */
    overdue: boolean;
    /** 最新一条留言来自顾客且商家尚未回复（工作台待回复提醒，无需单独已读表） */
    unread: boolean;
}

/** 售后状态计数（§81）：列表筛选旁的角标 */
export interface MerchantAfterSalesStateCount {
    state: string;
    count: number;
}

/** 售后申请清单（§81）：待处理数不受列表筛选影响，供入口红点 */
export interface MerchantAfterSalesList {
    items: MerchantAfterSalesRow[];
    /** 待商家处理数（Pending + Appealed），不受筛选影响 */
    pendingCount: number;
    /** 当前筛选条件命中总数 */
    total: number;
    /** 全店各状态计数（不受 state 筛选影响） */
    stateCounts: MerchantAfterSalesStateCount[];
    skip: number;
    take: number;
}

/** 售后列表筛选条件（§81） */
export interface MerchantAfterSalesListOptions {
    type?: string | null;
    /** 订单号模糊匹配（A2400xxx） */
    orderCode?: string | null;
    /** 申请时间下界（YYYY-MM-DD 或 ISO） */
    from?: string | null;
    /** 申请时间上界（YYYY-MM-DD 含当天 / ISO） */
    to?: string | null;
    skip?: number | null;
    take?: number | null;
}

/** 协商留言行（§81 商家端）：顾客与商家双向可见 */
export interface MerchantAfterSalesMessage {
    id: string;
    /** customer=顾客 / admin=商家 */
    senderType: string;
    senderName: string;
    content: string;
    images: string[];
    createdAt: Date;
}

/** 状态流转历史行（售后时间线） */
export interface MerchantAfterSalesHistoryRow {
    fromState: string | null;
    toState: string;
    createdAt: Date;
}

/** 收货地址（售后详情：商家确认退货/换货时核对） */
export interface MerchantAfterSalesAddress {
    fullName: string;
    phoneNumber: string;
    address: string;
}

/** 订单商品行（售后详情：协商退货/部分退款核对） */
export interface MerchantAfterSalesLine {
    name: string;
    quantity: number;
    /** 行单价（含税，分） */
    unitPrice: number;
}

/** 售后详情（§81）：列表行 + 协商留言 + 状态时间线 + 退款失败留痕 */
export interface MerchantAfterSalesDetail {
    request: MerchantAfterSalesRow;
    messages: MerchantAfterSalesMessage[];
    messageTotal: number;
    stateHistory: MerchantAfterSalesHistoryRow[];
    /** 退款失败原因（RefundFailed 留痕） */
    refundError: string | null;
    /** 实际退款到账金额（分，未退款为 null） */
    actualRefundAmount: number | null;
    /** 渠道处理时限（小时），用于前端展示超时口径 */
    timeoutHours: number;
    /** 顾客手机号（协商退货/换货联系用） */
    customerPhone: string | null;
    /** 订单收货地址 */
    shippingAddress: MerchantAfterSalesAddress | null;
    /** 订单商品行 */
    orderItems: MerchantAfterSalesLine[];
    /** 订单实付总额（含税，分） */
    orderTotal: number;
}

/** 售后处理统计（§81）：入口红点 + 今日处理量 + 今日退款额 */
export interface MerchantAfterSalesStats {
    /** 待商家处理（Pending + Appealed） */
    pending: number;
    /** 待处理中已超时的单数 */
    overdue: number;
    /** 渠道处理时限（小时） */
    timeoutHours: number;
    /** 今日已处理售后单数（状态流转到 Approved/Rejected/Refunded） */
    todayHandled: number;
    /** 今日退款成功单数 */
    todayRefunded: number;
    /** 今日退款金额（分） */
    todayRefundAmount: number;
    /** 待商家回复的售后会话数（最新留言来自顾客） */
    pendingReply: number;
}

export interface MerchantBoard {
    paused: boolean;
    /** 营业时段内且未临时休息（与 C 端 openNow 同口径，自动开关门生效依据） */
    openNow: boolean;
    /** 本店营业时间（Channel 自定义字段，空=全天营业） */
    businessHours: string | null;
    /** 下一次自动开门/打烊（null=全天营业或未配置） */
    nextTransition: BusinessTransition | null;
    merchantConfirmEnabled: boolean;
    printMode: 'off' | 'onPaid' | 'onAccepted';
    /** 打印通道（P1-4）：local=前端 C-Lodop；feie/yilianyun=服务端云打印 */
    printProvider: string;
    /** 云通道是否已配齐账号/设备/密钥（未配齐时前端提示去配置） */
    cloudPrintConfigured: boolean;
    storeName: string;
    storePhone: string | null;
    pending: MerchantBoardOrder[];
    cooking: MerchantBoardOrder[];
    awaitingRider: MerchantBoardOrder[];
    delivering: MerchantBoardOrder[];
    pendingDispatch: MerchantBoardOrder[]; // 待运营推送外部快递（R2 / R3-外部）
    thirdParty: MerchantBoardOrder[]; // 外部快递配送中
    ownedPool: MerchantBoardOrder[]; // 待自营快递接单（R3）
    ownedDispatched: MerchantBoardOrder[]; // 自营快递配送中
    merchantDelivering: MerchantBoardOrder[]; // 商户自行送往交接点（R1）
    scheduled: MerchantBoardOrder[]; // 预约单（plan 3.1）：已支付未放量，到点前 30min 自动进入待接单/大厅
    completedToday: number;
    completedTodayAmount: number;
    /** 今日休业（§70 营业日历）：true 时 C 端「今日休业」且禁止下单 */
    closedToday: boolean;
    /** 今日休业备注（如「国庆假期」），null=无备注或未休业 */
    closureNote: string | null;
    /** 未出餐订单数（§71）：待接单 + 备餐中，休业日提示商家尽快处理 */
    unfinishedOrders: number;
    /** 待处理顾客催单数（§78）：顾客催过且商家未「已知晓」的活跃单数 */
    urgedCount: number;
}

/** 商家自助经营：门店资料（营业时间存 Channel.customFields，与 C 端展示/下单闸门同源） */
export interface MerchantStoreProfile {
    storeName: string;
    businessHours: string | null;
    storeNotice: string | null;
    storePhone: string | null;
    paused: boolean;
    openNow: boolean;
    /** 今日是否休业（§70 营业日历）：true 时 C 端展示「今日休业」并禁止下单 */
    closedToday: boolean;
    /** 今日休业备注（如「国庆假期」），null=无备注或未休业 */
    closureNote: string | null;
    /** 已登记的休业日期（校园时区自然日，升序；已过去的日期不再返回） */
    closureDates: ClosureDate[];
    /** 下一次自动开门/打烊（null=全天营业或未配置），供经营设置页倒计时与打烊前提醒 */
    nextTransition: BusinessTransition | null;
    /** 未出餐订单数（§71）：待接单 + 备餐中，休业日提示商家尽快处理 */
    unfinishedOrders: number;
}

/** KDS 出餐屏（P1-4）：一单一张票，按等待时长分级提醒 */
export interface KitchenTicketLine {
    name: string;
    quantity: number;
    addons: string[];
}

export interface KitchenTicket {
    id: string;
    code: string;
    stage: 'pending' | 'cooking';
    createdAt: Date;
    waitingMinutes: number;
    /** normal=<15min，warn=15-25min，late=>25min */
    urgency: 'normal' | 'warn' | 'late';
    zone: string;
    building: string;
    slotText: string;
    note: string | null;
    printedAt: Date | null;
    total: number;
    /** 顾客催单待处理（§78）：出餐屏置顶并标「顾客催单」 */
    urged: boolean;
    lines: KitchenTicketLine[];
}

export interface KitchenQueue {
    tickets: KitchenTicket[];
    pendingCount: number;
    cookingCount: number;
    lateCount: number;
    /** 待处理顾客催单数（§78） */
    urgedCount: number;
    warnMinutes: number;
    lateMinutes: number;
}

/** 备餐汇总（§79）：某商品今日份数分布（待接单/备餐中/已出餐）与加料份数 */
export interface MerchantPrepAddon {
    name: string;
    quantity: number;
}

export interface MerchantPrepItem {
    /** 商品/规格名（与小票、出餐屏同口径） */
    name: string;
    /** 待接单份数 */
    pendingQty: number;
    /** 备餐中份数 */
    cookingQty: number;
    /** 今日已出餐（已送达）份数 */
    doneQty: number;
    /** 待做合计 = 待接单 + 备餐中 */
    todoQty: number;
    /** 今日合计 = 待做 + 已做 */
    totalQty: number;
    /** 加料/口味份数（如「加辣 ×3」），按待做 + 已做合并统计 */
    addons: MerchantPrepAddon[];
}

/** 营业日报（§80）：单日时段分布（校园时区 0-23 点） */
export interface MerchantDailyHour {
    hour: number;
    orders: number;
    gross: number;
}

/** 营业日报（§80）：单日商品销量行（销量按份数、金额按折后行小计） */
export interface MerchantDailyProduct {
    name: string;
    qty: number;
    amount: number;
}

/** 营业日报（§80）：对比口径（昨日 / 近 7 日均值） */
export interface MerchantDailyCompare {
    orders: number;
    gross: number;
    avgTicket: number;
}

/** 营业日报（§80）：单日经营快照 */
export interface MerchantDailyReport {
    /** 校园日 key（YYYY-MM-DD） */
    date: string;
    /** 当日已完成（已送达）单量 */
    orders: number;
    /** 当日营业额（分，订单实收总额） */
    gross: number;
    /** 客单价（分） */
    avgTicket: number;
    /** 当日取消单量（按下单日归日，与经营设置页同口径） */
    cancelled: number;
    /** 当日取消退款金额（分，取消单全额） */
    cancelledAmount: number;
    /** 时段分布：今天只出到当前小时，历史日 24 点全出 */
    hourly: MerchantDailyHour[];
    /** 销量 Top5（按份数降序，同份数按金额降序） */
    topProducts: MerchantDailyProduct[];
    /** 前一日同口径 */
    prev: MerchantDailyCompare;
    /** 前 7 日（不含当日）日均 */
    last7Avg: MerchantDailyCompare;
}

/** 出餐屏超时阈值（分钟）：15 分钟预警、25 分钟催单 */
export const KDS_WARN_MINUTES = 15;
export const KDS_LATE_MINUTES = 25;

/** 经营数据分桶（分）：营业额=窗口内已送达订单实付合计；取消=窗口内取消单（全额退款口径） */
export interface MerchantRevenueBucket {
    orders: number;
    gross: number;
    avgTicket: number;
    cancelled: number;
    cancelledAmount: number;
}

export interface MerchantRevenueDay {
    date: string; // MM-DD
    orders: number;
    gross: number;
    cancelled: number;
    cancelledAmount: number;
}

export interface MerchantRevenue {
    today: MerchantRevenueBucket;
    last7: MerchantRevenueBucket;
    days: MerchantRevenueDay[];
    /** P3-2 导出用：近 30 日（含今日）逐日明细，口径与 days 完全一致 */
    days30: MerchantRevenueDay[];
}

/**
 * 商家接单工作台（admin-api，CampusMerchant 权限，渠道隔离 = 商家角色绑定渠道）。
 * 状态机（merchantConfirmEnabled 渠道）：支付 → pending_merchant（待商家接单）
 * → accepted（备餐中，campusMerchantAcceptOrder）→ open（出餐完成入大厅，
 * campusMerchantCookingDone）→ 骑手 grabbed/delivering → delivered。
 */
@Injectable()
export class MerchantAdminService {
    constructor(
        private connection: TransactionalConnection,
        private config: CampusConfigService,
        private hall: HallService,
        private notify: CampusNotifyService,
        private thirdParty: ThirdPartyDeliveryService,
        private orderService: OrderService,
        private privacy: PrivacyNumberService,
        private cloud: CloudPrintService,
        private moduleRef?: ModuleRef,
    ) {}

    /** 售后插件为可选依赖：未安装时售后清单为空，「售后申请」入口降级隐藏 */
    private afterSalesSvc?: AfterSalesService | null;

    /** 退款重试冷却（§82）：同单 30 秒内只放行一次，防连点重复调用退款核心 */
    private refundRetryAt = new Map<number, number>();

    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private getAfterSales(): AfterSalesService | null {
        if (this.afterSalesSvc !== undefined) return this.afterSalesSvc ?? null;
        try {
            this.afterSalesSvc = this.moduleRef ? new Injector(this.moduleRef).get(AfterSalesService) : null;
        } catch (e: any) {
            this.afterSalesSvc = null;
            Logger.warn(`AfterSalesService 不可用，商家端售后处理降级: ${e?.message ?? e}`, 'CampusMerchant');
        }
        return this.afterSalesSvc ?? null;
    }

    /** 商家自助经营：门店资料（营业时间/公告/电话/营业状态） */
    async storeProfile(ctx: RequestContext): Promise<MerchantStoreProfile> {
        const cfg = await this.config.getConfig(ctx);
        const channel = await this.connection.getRepository(ctx, Channel)
            .findOne({ where: { id: ctx.channelId as any } });
        if (!channel) throw new UserInputError('当前店铺渠道不存在');
        const hours = ((channel.customFields ?? {}) as any).waimaiBusinessHours ?? null;
        const closureDates = safeClosureDates(cfg.closureDates);
        const closure = closedToday(closureDates);
        // 未出餐订单（§71）：休业日提醒商家仍有待接单/备餐中订单需处理；轮询 10s 一次，轻量计数
        const unfinishedOrders = await this.connection.getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.hallStatus IN ('pending_merchant','accepted')")
            .getCount();
        return {
            storeName: channel.code,
            businessHours: hours,
            storeNotice: cfg.storeNotice ?? null,
            storePhone: cfg.storePhone ?? null,
            paused: cfg.paused,
            // 与 C 端 openNow / 下单闸门同口径：营业时段内、未临时休息、且今日不在休业日历
            openNow: isWithinBusinessHours(hours) && !cfg.paused && !closure,
            closedToday: !!closure,
            closureNote: closure?.note ?? null,
            closureDates,
            nextTransition: nextBusinessTransition(hours),
            unfinishedOrders,
        };
    }

    /** 商家自助修改门店资料：营业时间走 Channel 自定义字段，公告/电话走履约配置白名单 */
    async updateStore(
        ctx: RequestContext,
        input: { businessHours?: string | null; storeNotice?: string | null; storePhone?: string | null },
    ): Promise<MerchantStoreProfile> {
        const patch: Record<string, string | null> = {};
        if (input.businessHours !== undefined) {
            const raw = String(input.businessHours ?? '').trim();
            if (raw) {
                if (raw.length > 100) throw new UserInputError('营业时间不能超过 100 个字符');
                // 必须能被营业时段解析器读懂，否则 C 端展示/下单闸门会误判
                if (!parseBusinessHours(raw).length) {
                    throw new UserInputError('营业时间格式不正确，示例：10:00-22:00 或 10:00-14:00,17:00-21:00');
                }
            }
            const repo = this.connection.getRepository(ctx, Channel);
            const channel = await repo.findOne({ where: { id: ctx.channelId as any } });
            if (!channel) throw new UserInputError('当前店铺渠道不存在');
            (channel.customFields as any).waimaiBusinessHours = raw || null;
            await repo.save(channel);
        }
        if (input.storeNotice !== undefined) patch.storeNotice = String(input.storeNotice ?? '').trim() || null;
        if (input.storePhone !== undefined) patch.storePhone = String(input.storePhone ?? '').trim() || null;
        if (Object.keys(patch).length) await this.config.updateConfig(ctx, patch);
        return this.storeProfile(ctx);
    }

    /** 营业日历（§70）：整体替换休业日期列表（传空数组=关闭休业日历），返回最新门店资料 */
    async updateClosureDates(
        ctx: RequestContext,
        dates: Array<{ date?: string | null; note?: string | null }> | null,
    ): Promise<MerchantStoreProfile> {
        const list = (dates ?? []).map(d => ({ date: String(d?.date ?? '').trim(), note: String(d?.note ?? '').trim() }));
        await this.config.updateConfig(ctx, { closureDates: list as any });
        return this.storeProfile(ctx);
    }

    /** 商家自助经营数据：今日/近 7 日（含今日）单量、营业额、客单价、取消退款；另附近 30 日逐日明细供导出 */
    async revenue(ctx: RequestContext): Promise<MerchantRevenue> {
        const now = Date.now();
        const today0 = startOfCampusDay(now);
        const DAY_MS = 24 * 3600_000;
        const DAYS = 30;
        const since = today0 - (DAYS - 1) * DAY_MS;
        const last7From = campusDayKey(today0 - 6 * DAY_MS);
        const orders = await this.connection.getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            .andWhere('order.createdAt >= :since', { since: new Date(since) })
            .getMany();
        const dayMap = new Map<string, MerchantRevenueDay>();
        for (let i = DAYS - 1; i >= 0; i--) {
            const key = campusDayKey(today0 - i * DAY_MS);
            dayMap.set(key, { date: key.slice(5), orders: 0, gross: 0, cancelled: 0, cancelledAmount: 0 });
        }
        const todayKey = campusDayKey(now);
        const empty = (): MerchantRevenueBucket => ({ orders: 0, gross: 0, avgTicket: 0, cancelled: 0, cancelledAmount: 0 });
        const today = empty();
        const last7 = empty();
        for (const o of orders) {
            const cf = o.customFields as any;
            const total = o.totalWithTax ?? 0;
            if (o.state === 'Cancelled') {
                const key = campusDayKey(new Date(o.createdAt).getTime());
                // 逐日口径：取消单按「下单日」归日，全额退款计 cancelledAmount
                const day = dayMap.get(key);
                if (day) {
                    day.cancelled += 1;
                    day.cancelledAmount += total;
                }
                // 窗口口径只统计近 7 日（查询窗口已扩到 30 日，必须显式收窄）
                if (key >= last7From) {
                    last7.cancelled += 1;
                    last7.cancelledAmount += total;
                    if (key === todayKey) {
                        today.cancelled += 1;
                        today.cancelledAmount += total;
                    }
                }
                continue;
            }
            if (cf.deliveryStatus !== 'delivered' || !cf.deliveredAt) continue;
            // 营业额按送达时间归日：跨零点订单计入实际送达当天
            const key = campusDayKey(new Date(cf.deliveredAt).getTime());
            const day = dayMap.get(key);
            if (day) {
                day.orders += 1;
                day.gross += total;
            }
            if (key >= last7From) {
                last7.orders += 1;
                last7.gross += total;
                if (key === todayKey) {
                    today.orders += 1;
                    today.gross += total;
                }
            }
        }
        today.avgTicket = today.orders ? Math.round(today.gross / today.orders) : 0;
        last7.avgTicket = last7.orders ? Math.round(last7.gross / last7.orders) : 0;
        const allDays = [...dayMap.values()];
        return { today, last7, days: allDays.slice(-7), days30: allDays };
    }

    /** 商家侧顾客联系方式（号码保护）：本渠道订单可查，开启后只返回脱敏/虚拟号 */
    async customerContact(ctx: RequestContext, orderId: ID) {
        const order = await this.connection.getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.id = :id', { id: orderId as any })
            .andWhere('channel.id = :ch', { ch: ctx.channelId as any })
            .getOne();
        if (!order) throw new UserInputError('订单不存在或不属于当前店铺');
        return this.privacy.resolve(ctx, {
            channelId: ctx.channelId,
            orderCode: order.code,
            phone: order.customer?.phoneNumber ?? null,
        });
    }

    /** 本渠道营业时间（Channel.customFields.waimaiBusinessHours）；原生查询，供工作台高频轮询 */
    private async channelBusinessHours(ctx: RequestContext): Promise<string | null> {
        const rows: any = await this.connection.rawConnection.query(
            'SELECT "customFieldsWaimaibusinesshours" AS hours FROM channel WHERE id = $1',
            [ctx.channelId as any],
        );
        const list: any[] = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const hours = list?.[0]?.hours;
        return hours == null || hours === '' ? null : String(hours);
    }

    async board(ctx: RequestContext): Promise<MerchantBoard> {
        const cfg = await this.config.getConfig(ctx);
        const repo = this.connection.getRepository(ctx, Order);
        const orders = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            // 仅拉活跃流转单：排除 delivered / cancelled / exception_final / no_rider_final 等终态，避免历史单无限增长
            .andWhere(
                "order.customFields.hallStatus IN ('pending_merchant','accepted','open','grabbed','pending_dispatch','third_party','owned_pool','owned_dispatched','merchant_delivering','scheduled')",
            )
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            // 顾客关联：工作台卡片展示脱敏手机号（便于按尾号检索/联系），不取明文
            .leftJoinAndSelect('order.customer', 'customer')
            .getMany();
        // 今日已送达口径：按校园时区（UTC+8）日界，不随部署服务器时区漂移
        const startOfDay = new Date(startOfCampusDay(Date.now()));
        const deliveredToday = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.deliveryStatus = 'delivered'")
            .andWhere('order.customFields.deliveredAt >= :start', { start: startOfDay })
            .getMany();

        const active = orders.filter(o => {
            const cf = o.customFields as any;
            // 送达终态不再进流转栏（兼容历史脏数据：hallStatus 仍为 grabbed 但已送达）
            if (cf.deliveryStatus === 'delivered') return false;
            return [
                'pending_merchant', 'accepted', 'open', 'grabbed',
                'pending_dispatch', 'third_party', 'owned_pool', 'owned_dispatched', 'merchant_delivering',
            ].includes(cf.hallStatus);
        });
        // 预约单（scheduled）：按预约锚点升序，供商家提前备料知悉（不进入四栏流转）
        const scheduledOrders = orders
            .filter(o => (o.customFields as any).hallStatus === 'scheduled')
            .sort((a, b) => {
                const ta = new Date((a.customFields as any).scheduledFor ?? 0).getTime();
                const tb = new Date((b.customFields as any).scheduledFor ?? 0).getTime();
                return ta - tb;
            });
        const dtos = await this.toDto(ctx, active);
        const scheduledDtos = await this.toDto(ctx, scheduledOrders);
        const cfOf = (o: Order) => o.customFields as any;
        const pending = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'pending_merchant');
        const cooking = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'accepted');
        const awaitingRider = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'open');
        const delivering = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'grabbed');
        const pick = (s: string) => dtos.filter((_, i) => cfOf(active[i]).hallStatus === s);
        const completedTodayAmount = deliveredToday.reduce((s, o) => s + (o.total || 0), 0);
        const printProvider = String(cfg.printProvider ?? 'local');
        // 营业时间（自动开关门）：轻量原生查询，避免工作台 10s 轮询时反复实例化 Channel 实体
        const hours = await this.channelBusinessHours(ctx);
        const closure = closedToday(safeClosureDates(cfg.closureDates));
        return {
            paused: cfg.paused,
            openNow: isWithinBusinessHours(hours) && !cfg.paused && !closure,
            businessHours: hours,
            nextTransition: nextBusinessTransition(hours),
            merchantConfirmEnabled: cfg.merchantConfirmEnabled,
            printMode: normalizePrintMode(cfg.printMode),
            printProvider,
            cloudPrintConfigured:
                printProvider !== 'local' && !!cfg.printAccount && !!cfg.printDeviceSn && !!cfg.printDeviceKey,
            storeName: ctx.channel?.code ?? '',
            storePhone: cfg.storePhone ?? null,
            pending,
            cooking,
            awaitingRider,
            delivering,
            pendingDispatch: pick('pending_dispatch'),
            thirdParty: pick('third_party'),
            ownedPool: pick('owned_pool'),
            ownedDispatched: pick('owned_dispatched'),
            merchantDelivering: pick('merchant_delivering'),
            scheduled: scheduledDtos,
            completedToday: deliveredToday.length,
            completedTodayAmount,
            closedToday: !!closure,
            closureNote: closure?.note ?? null,
            // 未出餐 = 待接单 + 备餐中（出餐完成即退出该计数）
            unfinishedOrders: pending.length + cooking.length,
            // 待处理顾客催单（§78）：活跃单里催过且商家未「已知晓」的单数
            urgedCount: dtos.filter(d => d.urged).length,
        };
    }

    /**
     * 今日/区间已完成订单明细（§75 对账）：送达口径与工作台「今日完成」一致
     * （customFields.deliveryStatus = 'delivered' + deliveredAt 落区间），
     * 汇总按全区间统计（不受分页影响），退款取该单全部非 Failed 退款单之和。
     */
    async completedOrders(
        ctx: RequestContext,
        input: { from?: string | null; to?: string | null; take?: number | null; skip?: number | null },
    ): Promise<MerchantCompletedOrders> {
        const now = Date.now();
        const start = new Date(input.from ? String(input.from) : startOfCampusDay(now));
        const end = new Date(input.to ? String(input.to) : now);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new UserInputError('时间区间格式不合法');
        }
        if (start.getTime() >= end.getTime()) throw new UserInputError('结束时间必须晚于开始时间');
        // 明细按区间累计，防止误传超长区间把工作台拖慢（92 天足够覆盖季度对账前查看）
        if (end.getTime() - start.getTime() > 92 * 24 * 3600_000) {
            throw new UserInputError('查询区间不能超过 92 天');
        }
        const take = Math.min(Math.max(Number(input.take ?? 100) || 100, 1), 300);
        const skip = Math.max(Number(input.skip ?? 0) || 0, 0);

        const repo = this.connection.getRepository(ctx, Order);
        const base = () =>
            repo
                .createQueryBuilder('order')
                .leftJoin('order.channels', 'channel')
                .where('channel.id = :ch', { ch: ctx.channelId as any })
                .andWhere("order.customFields.deliveryStatus = 'delivered'")
                .andWhere('order.customFields.deliveredAt >= :start', { start })
                .andWhere('order.customFields.deliveredAt < :end', { end });

        // 汇总：单量 + 总额（全区间，不被分页截断）
        // 注意：Order.total / totalWithTax 都是实体 getter（无对应数据库列），聚合须落到真实列 subTotalWithTax + shippingWithTax
        const sums: any = await base()
            .select(
                'COALESCE(SUM(COALESCE("order"."subTotalWithTax", 0) + COALESCE("order"."shippingWithTax", 0)), 0)',
                'amount',
            )
            .addSelect('COUNT("order"."id")', 'count')
            .getRawOne();
        const total = Number(sums?.count ?? 0);
        const totalAmount = Number(sums?.amount ?? 0);

        const orders = await base()
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .leftJoinAndSelect('order.customer', 'customer')
            .orderBy('order.customFields.deliveredAt', 'DESC', 'NULLS LAST')
            .skip(skip)
            .take(take)
            .getMany();

        // 退款金额：按订单聚合（payment 关联订单，Failed 退款不计入）
        const refunds = new Map<string, number>();
        // 已支付金额（§76 可退余额口径）：只认 Settled/Authorized，与 refundablePayments 一致
        const paids = new Map<string, number>();
        if (orders.length) {
            const ids = orders.map(o => Number(o.id));
            const rows: any[] = await this.connection.rawConnection.query(
                `SELECT p."orderId" AS "orderId", COALESCE(SUM(r.total), 0) AS "amount"
                   FROM refund r
                   JOIN payment p ON p.id = r."paymentId"
                  WHERE p."orderId" IN (${ids.map((_, i) => '$' + (i + 1)).join(',')})
                    AND r.state <> 'Failed'
                  GROUP BY p."orderId"`,
                ids,
            );
            for (const row of rows ?? []) refunds.set(String(row.orderId), Number(row.amount ?? 0));
            const paidRows: any[] = await this.connection.rawConnection.query(
                `SELECT p."orderId" AS "orderId", COALESCE(SUM(p.amount), 0) AS "amount"
                   FROM payment p
                  WHERE p."orderId" IN (${ids.map((_, i) => '$' + (i + 1)).join(',')})
                    AND p.state IN ('Settled', 'Authorized')
                  GROUP BY p."orderId"`,
                ids,
            );
            for (const row of paidRows ?? []) paids.set(String(row.orderId), Number(row.amount ?? 0));
        }

        const buildingIds = new Set<string>();
        const riderIds = new Set<number>();
        for (const o of orders) {
            const cf = o.customFields as any;
            if (cf.buildingId) buildingIds.add(String(cf.buildingId));
            if (cf.deliveryStaffId) riderIds.add(Number(cf.deliveryStaffId));
        }
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        const riders = riderIds.size
            ? await this.connection.rawConnection.getRepository('Customer').findByIds([...riderIds])
            : [];
        const riderNames = new Map((riders as any[]).map(c => [String(c.id), c.customFields?.riderRealName ?? '']));

        const items: MerchantCompletedOrder[] = orders.map(o => {
            const cf = o.customFields as any;
            const refundAmount = refunds.get(String(o.id)) ?? 0;
            // 可退余额 = 已支付 − 已退（§76）：未支付 / 已全额退款为 0，前端据此隐藏退款入口
            const refundable = Math.max((paids.get(String(o.id)) ?? 0) - refundAmount, 0);
            const lineText = (o.lines ?? [])
                .map(l => `${l.productVariant?.name ?? ''}×${l.quantity}`)
                .filter(s => s.length > 0)
                .join('、');
            return {
                id: String(o.id),
                code: o.code,
                deliveredAt: cf.deliveredAt ? new Date(cf.deliveredAt) : null,
                createdAt: o.createdAt,
                total: o.totalWithTax,
                refundAmount,
                netAmount: (o.totalWithTax || 0) - refundAmount,
                refundable,
                building: cf.buildingId ? buildingNames.get(String(cf.buildingId)) ?? '' : '',
                zone: cf.campusZone ?? '',
                route: cf.fulfillmentRoute ?? '',
                riderName: cf.deliveryStaffId ? riderNames.get(String(cf.deliveryStaffId)) ?? null : null,
                customerPhone: this.privacy.mask(o.customer?.phoneNumber ?? null),
                lineText,
                note: cf.note ?? null,
            };
        });

        // 区间退款总额：按订单聚合退款单（Failed 不计），不受分页影响
        const refundSum: any = await base()
            .leftJoin('order.payments', 'payment')
            .leftJoin('payment.refunds', 'refund')
            .select('COALESCE(SUM(refund.total), 0)', 'amount')
            .andWhere("refund.state <> 'Failed'")
            .getRawOne();
        const refundAmount = Number(refundSum?.amount ?? 0);
        return {
            items,
            total,
            totalAmount,
            refundAmount,
            netAmount: totalAmount - refundAmount,
            avgTicket: total > 0 ? Math.round((totalAmount - refundAmount) / total) : 0,
            start,
            end,
        };
    }

    /**
     * 退款记录台账（§77）：按渠道聚合退款单（refund → payment → order），
     * 与 §76 口径一致——Failed 退款单单独计数留痕但不计入退款总额；
     * reason 去掉商家退款留痕前缀（merchant refund (单号):）后再返回。
     */
    async refunds(
        ctx: RequestContext,
        input: { from?: string | null; to?: string | null; take?: number | null; skip?: number | null },
    ): Promise<MerchantRefundList> {
        const now = Date.now();
        const start = new Date(input.from ? String(input.from) : startOfCampusDay(now));
        const end = new Date(input.to ? String(input.to) : now);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new UserInputError('时间区间格式不合法');
        }
        if (start.getTime() >= end.getTime()) throw new UserInputError('结束时间必须晚于开始时间');
        if (end.getTime() - start.getTime() > 92 * 24 * 3600_000) {
            throw new UserInputError('查询区间不能超过 92 天');
        }
        const take = Math.min(Math.max(Number(input.take ?? 100) || 100, 1), 300);
        const skip = Math.max(Number(input.skip ?? 0) || 0, 0);

        const raw = this.connection.rawConnection;
        const chId = Number(ctx.channelId);
        // 店铺隔离：退款单经支付单回落到订单，再用订单-渠道关联表判定归属（EXISTS 避免重复行）
        // 关联表名由 TypeORM 惯用命名生成：order_channels_channel
        const scope = `r."createdAt" >= $1 AND r."createdAt" < $2
              AND EXISTS (SELECT 1 FROM order_channels_channel oc WHERE oc."orderId" = o.id AND oc."channelId" = $3)`;
        const rows: any[] = await raw.query(
            `SELECT r.id AS "id", r.total AS "amount", r.state AS "state", r.reason AS "reason",
                    r."createdAt" AS "createdAt", p."orderId" AS "orderId", o.code AS "code"
               FROM refund r
               JOIN payment p ON p.id = r."paymentId"
               JOIN "order" o ON o.id = p."orderId"
              WHERE ${scope}
              ORDER BY r."createdAt" DESC
              LIMIT $4 OFFSET $5`,
            [start, end, chId, take, skip],
        );

        // 汇总：区分成功/失败笔数与金额（全区间，不受分页影响）
        const agg: any[] = await raw.query(
            `SELECT COUNT(*) FILTER (WHERE r.state <> 'Failed') AS "count",
                    COALESCE(SUM(r.total) FILTER (WHERE r.state <> 'Failed'), 0) AS "amount",
                    COUNT(*) FILTER (WHERE r.state = 'Failed') AS "failedCount",
                    COALESCE(SUM(r.total) FILTER (WHERE r.state = 'Failed'), 0) AS "failedAmount",
                    COUNT(*) AS "total"
               FROM refund r
               JOIN payment p ON p.id = r."paymentId"
               JOIN "order" o ON o.id = p."orderId"
              WHERE ${scope}`,
            [start, end, chId],
        );
        const sum = agg?.[0] ?? {};

        // 楼栋/区域：自定义字段只在订单实体上，按订单 id 回查（避免猜原生列名）
        const orderIds = [...new Set(rows.map(r => String(r.orderId)))];
        const orders = orderIds.length
            ? await this.connection.getRepository(ctx, Order).findByIds(orderIds as any)
            : [];
        const orderMap = new Map(orders.map(o => [String(o.id), o.customFields as any]));
        const buildingIds = new Set<string>();
        for (const cf of orderMap.values()) if (cf?.buildingId) buildingIds.add(String(cf.buildingId));
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, CampusBuilding).findByIds([...buildingIds] as any)
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));

        // 商家退款原因写入了「merchant refund (单号): 原因」留痕前缀，展示时剥掉
        const MERCHANT_PREFIX = /^merchant refund \([^)]*\):\s*/;
        const items: MerchantRefundRow[] = rows.map(r => {
            const rawReason = String(r.reason ?? '');
            const cf = orderMap.get(String(r.orderId));
            return {
                id: String(r.id),
                orderId: String(r.orderId),
                code: String(r.code ?? ''),
                amount: Number(r.amount ?? 0),
                state: String(r.state ?? ''),
                reason: rawReason.replace(MERCHANT_PREFIX, ''),
                source: MERCHANT_PREFIX.test(rawReason) ? 'merchant' : 'platform',
                createdAt: new Date(r.createdAt),
                building: cf?.buildingId ? buildingNames.get(String(cf.buildingId)) ?? '' : '',
                zone: cf?.campusZone ?? '',
            };
        });

        return {
            items,
            count: Number(sum.count ?? 0),
            amount: Number(sum.amount ?? 0),
            failedCount: Number(sum.failedCount ?? 0),
            failedAmount: Number(sum.failedAmount ?? 0),
            total: Number(sum.total ?? 0),
            start,
            end,
        };
    }

    /** 商家接单确认：pending_merchant → accepted */
    async acceptOrder(ctx: RequestContext, orderId: ID) {
        const order = await this.assertChannelOrder(ctx, orderId, 'pending_merchant');
        const moved = await this.transitionToAccepted(ctx, order.id as any, 'manual');
        if (!moved) throw new UserInputError('订单状态已变更，请刷新');
        return { ok: true };
    }

    /** 接单内核（手动/自动共用）：条件写防并发 + 用户通知 + 接单即出票；返回是否真正迁移成功 */
    async transitionToAccepted(ctx: RequestContext, orderId: ID, trigger: 'manual' | 'auto'): Promise<boolean> {
        const patch: Record<string, unknown> = { hallStatus: 'accepted' };
        // 自动接单留痕：既做每日上限统计，也方便客服区分人工/自动接单
        if (trigger === 'auto') patch.autoAcceptedAt = new Date();
        // 条件写：与用户取消/调度商家超时兜底并发时，已脱厅单不得被改回 accepted
        const moved = await this.hall.transitionFrom(ctx, Number(orderId), ['pending_merchant'], patch);
        if (!moved) return false;
        this.notify.user(ctx, orderId as any, 'orderAccepted');
        // 云打印（P1-4）：接单即出票（printMode=onAccepted 且走云通道）；失败只留任务记录，不阻塞接单
        const cfg = await this.config.getConfig(ctx);
        if (normalizePrintMode(cfg.printMode) === 'onAccepted' && String(cfg.printProvider ?? 'local') !== 'local') {
            void this.cloud.printOrder(ctx, orderId as any, 'auto').catch(() => undefined);
        }
        return true;
    }

    /** 商家拒单/商品缺货：接单前（pending_merchant）或备餐中（accepted）可拒，
     * 全额退款 + 取消订单（取消后由 Cancelled 转换自动脱厅/释放时段锁位）。
     * 退款幂等口径与 T4/异常处置一致：先查已退总额，仅退剩余部分。 */
    async rejectOrder(ctx: RequestContext, orderId: ID, reason: string) {
        const trimmed = (reason ?? '').trim();
        if (!trimmed) throw new UserInputError('请填写拒单原因');
        if (trimmed.length > 200) throw new UserInputError('拒单原因不能超过 200 个字符');
        const order = await this.assertChannelOrderState(ctx, orderId, ['pending_merchant', 'accepted']);

        // 并发防重退款：拒单是「查已退总额 → 退差额 → 取消」的复合动作，
        // 与 T4/运营处置并发时无锁会双退。用 PG 会话级咨询锁按订单串行化（同连接 runner 持有/释放）。
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:refund:${order.id}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) throw new UserInputError('该订单正在退款处理中，请稍后重试');
            // 锁内复查：等待锁期间订单可能已被 T4/调度超时兜底改派或用户取消，
            // 此时再退款+取消会把已流转的单重复退款
            const fresh = await this.connection.getRepository(ctx, Order).findOne({
                where: { id: order.id as any },
            });
            const freshHs = String((fresh?.customFields as any)?.hallStatus ?? '');
            if (!['pending_merchant', 'accepted'].includes(freshHs)) {
                throw new UserInputError('订单状态已变更，请刷新');
            }

            // 只退成功支付且仍有余额的支付单（避免选中 Declined/Error 重试单导致退款失败）
            for (const picked of await refundablePayments(this.connection, Number(order.id))) {
                const rest = picked.remaining;
                if (rest > 0) {
                    const created: any = await this.orderService.refundOrder(ctx, {
                        paymentId: picked.payment.id,
                        amount: rest,
                        // refund 表 shipping/adjustment 列 NOT NULL，显式给 0（同 T4）
                        shipping: 0,
                        adjustment: 0,
                        reason: `merchant reject (${order.code})`,
                    } as any);
                    if (!created || created.errorCode) {
                        throw new UserInputError(`退款失败：${created?.errorCode ?? '未知原因'}`);
                    }
                    await settleRefundOrMarkFailed(this.connection, this.orderService, ctx, created.id);
                }
            }

            // 先留痕再取消：脱厅只写 hallStatus，不覆盖 campusCause
            await this.hall.updateOrder(ctx, order.id as any, {
                customFields: { campusCause: 'merchant_rejected' },
            } as any);
            const cancelled = await this.orderService.cancelOrder(ctx, {
                orderId: order.id as any,
                reason: `商家拒单：${trimmed}`,
            } as any);
            if (cancelled && (cancelled as any).errorCode) {
                throw new Error(`cancelOrder failed: ${(cancelled as any).errorCode}`);
            }
            this.notify.user(ctx, order.id as any, 'orderCancelled', trimmed);
            return { ok: true };
        } finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            } catch {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }

    /** 商家发起退款（§76）：已送达订单可整单/部分退款，复用既有 refund 通道。
     * 与拒单/运营异常处置共用订单级咨询锁，避免并发双退。 */
    async merchantRefund(ctx: RequestContext, orderId: ID, amount: number, reason: string): Promise<MerchantRefundResult> {
        const trimmed = (reason ?? '').trim();
        if (!trimmed) throw new UserInputError('请填写退款原因');
        if (trimmed.length > 200) throw new UserInputError('退款原因不能超过 200 个字符');
        const fen = Math.floor(Number(amount));
        if (!Number.isFinite(fen) || fen <= 0) throw new UserInputError('退款金额必须大于 0');

        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        // 只对已送达单开放：在途单请走「拒单」（备餐中）或联系运营异常处置，避免配送与退款错位
        if (String((order.customFields as any).deliveryStatus ?? '') !== 'delivered') {
            throw new UserInputError('仅已送达订单可发起退款');
        }

        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:refund:${order.id}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) throw new UserInputError('该订单正在退款处理中，请稍后重试');

            // 锁内重新统计余额（与运营处置/拒单并发时以最新余额为准）
            const payments = await refundablePayments(this.connection, Number(order.id));
            const remaining = payments.reduce((s, p) => s + p.remaining, 0);
            if (remaining <= 0) throw new UserInputError('该订单已无可退余额');
            if (fen > remaining) {
                throw new UserInputError(`退款金额超过可退余额（最多可退 ¥${(remaining / 100).toFixed(2)}）`);
            }

            // 新→旧逐张退，凑够本次金额（多支付单订单按各张余额分摊）
            let rest = fen;
            for (const picked of payments) {
                if (rest <= 0) break;
                const part = Math.min(rest, picked.remaining);
                const created: any = await this.orderService.refundOrder(ctx, {
                    paymentId: picked.payment.id,
                    amount: part,
                    // refund 表 shipping/adjustment 列 NOT NULL，显式给 0（同 T4/拒单）
                    shipping: 0,
                    adjustment: 0,
                    reason: `merchant refund (${order.code}): ${trimmed}`,
                } as any);
                if (!created || created.errorCode) {
                    throw new UserInputError(`退款失败：${created?.errorCode ?? '未知原因'}`);
                }
                await settleRefundOrMarkFailed(this.connection, this.orderService, ctx, created.id);
                rest -= part;
            }

            // 售后触达顾客（未配置模板/短信网关时静默跳过）
            this.notify.user(ctx, order.id as any, 'afterSales', `商家退款 ¥${(fen / 100).toFixed(2)} 已原路退回`);

            // 回执口径与对账页一致：累计已退排除 Failed（结算失败单不改变实际余额）
            const refundedRows: any[] = await this.connection.rawConnection.query(
                `SELECT COALESCE(SUM(r.total), 0) AS "amount"
                   FROM refund r
                   JOIN payment p ON p.id = r."paymentId"
                  WHERE p."orderId" = $1 AND r.state <> 'Failed'`,
                [Number(order.id)],
            );
            const refundedTotal = Number(refundedRows?.[0]?.amount ?? 0);
            const after = await refundablePayments(this.connection, Number(order.id));
            const refundable = after.reduce((s, p) => s + p.remaining, 0);
            return { ok: true, amount: fen, refundedTotal, refundable };
        } finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            } catch {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }

    /** 出餐完成：按路线/承运分流（不再统一入抢单大厅） */
    async cookingDone(ctx: RequestContext, orderId: ID) {
        const order = await this.assertChannelOrder(ctx, orderId, 'accepted');
        const cf = order.customFields as any;
        const route = String(cf.fulfillmentRoute ?? '');
        const plan = String(cf.deliveryPlan ?? '');

        let patch: Record<string, unknown>;
        // R1：第一段由商户或自营快递完成，之后才进校园接力大厅
        if (route === 'R1') {
            patch = plan === 'owned'
                // 自营快递接单后送往交接点（cookingDone 即表示可以出发）
                ? { hallStatus: 'owned_dispatched', assignedAt: new Date() }
                : { hallStatus: 'merchant_delivering', assignedAt: new Date() };
        } else if (plan === 'external_courier') {
            // R2 与 R3-外部：等运营中心推送外部快递（assignedAt 标记出餐时刻，未推送超时从此计时）
            patch = { hallStatus: 'pending_dispatch', assignedAt: new Date() };
        } else if (plan === 'owned') {
            // R3-自营：进自营快递池抢单
            patch = { hallStatus: 'owned_pool' };
        } else {
            // R3-传信者：正常入抢单大厅
            patch = { hallStatus: 'open', hallEnteredAt: new Date() };
        }
        // 条件写：与用户取消/调度超时兜底并发时，已脱厅单不得被改回流转态
        const moved = await this.hall.transitionFrom(ctx, Number(order.id), ['accepted'], patch);
        if (!moved) throw new UserInputError('订单状态已变更，请刷新');
        this.notify.user(ctx, order.id as any, 'cookingDone');
        return { ok: true };
    }

    /** 批量接单（§73）：逐单复用单笔接单（含通知/云打印），失败跳过并回报 */
    async batchAcceptOrders(ctx: RequestContext, orderIds: ID[]): Promise<BatchOrderResult> {
        return this.runBatch(orderIds, id => this.acceptOrder(ctx, id));
    }

    /** 批量出餐（§73）：逐单复用单笔出餐分流，失败跳过并回报 */
    async batchCookingDone(ctx: RequestContext, orderIds: ID[]): Promise<BatchOrderResult> {
        return this.runBatch(orderIds, id => this.cookingDone(ctx, id));
    }

    /** 顺序执行批量动作：单笔失败（状态已变更/已脱厅/退款中等）只记明细，不中断后续单 */
    private async runBatch(orderIds: ID[], run: (id: ID) => Promise<unknown>): Promise<BatchOrderResult> {
        let ids: string[];
        try {
            ids = normalizeBatchOrderIds(orderIds);
        } catch (err: any) {
            // 入参问题（空集合 / 超上限）属于调用方错误，直接以 UserInputError 反馈
            throw err instanceof BatchOrderInputError ? new UserInputError(err.message) : err;
        }
        let ok = 0;
        const failed: BatchOrderResult['failed'] = [];
        for (const id of ids) {
            try {
                await run(id as any);
                ok++;
            } catch (err: any) {
                failed.push({ orderId: id, message: err?.message ?? '操作失败' });
            }
        }
        return { ok, failed };
    }

    /** 运营中心推送外部快递（选 dada / meituan） */
    async dispatchExternal(ctx: RequestContext, orderId: ID, provider: ExternalProviderCode) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.dispatchExternal(ctx, orderId as any, provider);
    }

    /** 取消外部快递（改推另一家 / 回落大厅前） */
    async cancelExternal(ctx: RequestContext, orderId: ID, reason?: string) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.cancel(ctx, orderId as any, reason);
    }

    /** 自营快递接单（R1 商户超时转自营 / R3 自营池） */
    async acceptOwned(ctx: RequestContext, orderId: ID) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.acceptOwned(ctx, orderId as any);
    }

    /** R1：商户把餐送到校园交接点 → 传信者接力 */
    async markHandoverArrived(ctx: RequestContext, orderId: ID) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.completeFirstLeg(ctx, orderId as any, 'merchant_handover');
    }

    /** 自营快递送达（R1/R2 到交接点，R3 到学生） */
    async markOwnedArrived(ctx: RequestContext, orderId: ID) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.completeFirstLeg(ctx, orderId as any, 'owned_handover');
    }

    /** 营业开关：商家仅可切换本渠道 paused，其余配置仍归 CampusConfig 管理员 */
    async setPaused(ctx: RequestContext, paused: boolean) {
        await this.config.updateConfig(ctx, { paused });
        return { ok: true };
    }

    /** 自动接单设置（§69）：含今日已自动接单数与当前营业条件（休息中自动失效） */
    async autoAcceptSettings(ctx: RequestContext) {
        const cfg = await this.config.getConfig(ctx);
        const hours = await this.channelBusinessHours(ctx);
        return {
            enabled: !!cfg.autoAcceptEnabled,
            delaySeconds: Number(cfg.autoAcceptDelaySeconds ?? AUTO_ACCEPT_DEFAULT_DELAY_SECONDS),
            dailyLimit: Number(cfg.autoAcceptDailyLimit ?? 0),
            routes: normalizeAutoAcceptRoutes(cfg.autoAcceptRoutes),
            acceptedToday: await this.countAutoAcceptedToday(ctx.channelId),
            // 与手动接单/C 端营业态同口径：营业时段内、未临时休息、且今日不在休业日历才会自动接
            openNow: isWithinBusinessHours(hours) && !cfg.paused && !closedToday(safeClosureDates(cfg.closureDates)),
            merchantConfirmEnabled: !!cfg.merchantConfirmEnabled,
        };
    }

    /** 自动接单设置保存：延迟/上限/路线走配置白名单校验（越界直接报错，不静默截断） */
    async updateAutoAccept(
        ctx: RequestContext,
        input: { enabled: boolean; delaySeconds?: number | null; dailyLimit?: number | null; routes?: string[] | null },
    ) {
        const patch: Record<string, unknown> = { autoAcceptEnabled: !!input.enabled };
        if (input.delaySeconds !== undefined && input.delaySeconds !== null) {
            patch.autoAcceptDelaySeconds = Number(input.delaySeconds);
        }
        if (input.dailyLimit !== undefined && input.dailyLimit !== null) {
            patch.autoAcceptDailyLimit = Number(input.dailyLimit);
        }
        if (input.routes !== undefined && input.routes !== null) {
            patch.autoAcceptRoutes = normalizeAutoAcceptRoutes(input.routes);
        }
        await this.config.updateConfig(ctx, patch as any);
        return this.autoAcceptSettings(ctx);
    }

    /** 本店本校园日自动接单数（按 autoAcceptedAt 统计，跨零点自动归零） */
    async countAutoAcceptedToday(channelId: ID): Promise<number> {
        const rows: any = await this.connection.rawConnection.query(
            'SELECT COUNT(*)::int AS n FROM "order" o '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id AND oc."channelId" = $1 '
            + 'WHERE o."customFieldsAutoacceptedat" >= $2',
            [channelId, new Date(startOfCampusDay(Date.now()))],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        return Number(Array.isArray(list) ? list[0]?.n ?? 0 : 0) || 0;
    }

    /** 小票打印回执：工作台打印成功后回写 waimaiPrintedAt（防重打 + 补打依据），不限订单状态 */
    async markPrinted(ctx: RequestContext, orderId: ID) {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        await this.hall.updateOrder(ctx, order.id as any, {
            customFields: { waimaiPrintedAt: new Date() },
        } as any);
        return { ok: true };
    }

    /** 商家确认「已知晓」顾客催单（§78）：只落小表时间戳，不改顾客侧 urged/urgedAt（骑手端仍可见催单标记） */
    async ackUrge(ctx: RequestContext, orderId: ID) {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        const cf = (order.customFields ?? {}) as any;
        if (cf.urged !== true || !cf.urgedAt) throw new UserInputError('该订单没有待处理的顾客催单');
        await this.connection.rawConnection.query(
            'INSERT INTO campus_urge_ack ("channelId", "orderId", "ackedAt") VALUES ($1, $2, now()) '
            + 'ON CONFLICT ("channelId", "orderId") DO UPDATE SET "ackedAt" = now(), "updatedAt" = now()',
            [ctx.channelId, Number(order.id)],
        );
        return { ok: true };
    }

    /** 批量取催单「已知晓」时间（§78）；小表缺失时按未处理兜底，不阻断工作台 */
    private async urgeAckMap(ctx: RequestContext, orderIds: number[]): Promise<Map<string, Date>> {
        const ids = orderIds.filter(n => Number.isFinite(n));
        if (!ids.length) return new Map();
        try {
            const rows: any = await this.connection.rawConnection.query(
                'SELECT "orderId", "ackedAt" FROM campus_urge_ack WHERE "channelId" = $1 AND "orderId" = ANY($2::int[])',
                [ctx.channelId, ids],
            );
            const list: any[] = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
            return new Map((Array.isArray(list) ? list : []).map((r: any) => [
                String(r.orderId),
                new Date(r.ackedAt),
            ]));
        } catch {
            return new Map();
        }
    }

    /** 云打印一张小票（后端签名直连服务商）：成功即回写 printedAt */
    async cloudPrint(ctx: RequestContext, orderId: ID) {
        return this.cloud.printOrder(ctx, orderId, 'manual');
    }

    /** 云打印连通性测试（不占用订单） */
    async cloudPrintTest(ctx: RequestContext) {
        return this.cloud.testPrint(ctx);
    }

    /** 最近云打印任务（排障） */
    async printJobs(ctx: RequestContext, limit?: number) {
        return this.cloud.recentJobs(ctx, limit);
    }

    /** KDS 出餐屏队列：待接单 + 备餐中（按支付先后出票，超时标红） */
    async kitchenQueue(ctx: RequestContext): Promise<KitchenQueue> {
        const orders = await this.connection.getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.hallStatus IN ('pending_merchant','accepted')")
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .orderBy('order.createdAt', 'ASC')
            .getMany();
        const buildingIds = new Set<string>();
        for (const o of orders) {
            const id = (o.customFields as any).buildingId;
            if (id) buildingIds.add(String(id));
        }
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        const now = Date.now();
        const ackMap = await this.urgeAckMap(ctx, orders.map(o => Number(o.id)));
        const tickets: KitchenTicket[] = orders.map(o => {
            const cf = o.customFields as any;
            const urgedAt = cf.urgedAt ? new Date(cf.urgedAt) : null;
            const waitingMinutes = Math.max(0, Math.floor((now - new Date(o.createdAt).getTime()) / 60000));
            return {
                id: String(o.id),
                code: o.code,
                stage: cf.hallStatus === 'accepted' ? 'cooking' : 'pending',
                createdAt: o.createdAt,
                waitingMinutes,
                urgency: waitingMinutes >= KDS_LATE_MINUTES ? 'late' : waitingMinutes >= KDS_WARN_MINUTES ? 'warn' : 'normal',
                zone: cf.campusZone ?? '',
                building: cf.buildingId ? buildingNames.get(String(cf.buildingId)) ?? '' : '',
                slotText: cf.deliverySlotText ?? '',
                note: cf.note ?? null,
                printedAt: (cf.waimaiPrintedAt as Date | undefined) ?? null,
                total: o.total,
                urged: isUrgePending(cf.urged, urgedAt, ackMap.get(String(o.id)) ?? null),
                lines: (o.lines ?? []).map(l => {
                    const addonsText = addonDisplayText((l.customFields as any)?.waimaiAddons);
                    return {
                        name: l.productVariant?.name ?? '',
                        quantity: l.quantity,
                        addons: addonsText ? addonsText.split(' / ') : [],
                    };
                }),
            };
        });
        // 顾客催单的票排前面（同催单状态下仍按支付先后）
        tickets.sort((a, b) => Number(b.urged) - Number(a.urged) || +a.createdAt - +b.createdAt);
        return {
            tickets,
            pendingCount: tickets.filter(t => t.stage === 'pending').length,
            cookingCount: tickets.filter(t => t.stage === 'cooking').length,
            lateCount: tickets.filter(t => t.urgency === 'late').length,
            urgedCount: tickets.filter(t => t.urged).length,
            warnMinutes: KDS_WARN_MINUTES,
            lateMinutes: KDS_LATE_MINUTES,
        };
    }

    /**
     * 备餐汇总（§79）：今日「待接单 + 备餐中」按商品聚合待做份数，
     * 叠加今日已送达份数，供后厨按份备料；加料/口味按同一商品合并计数。
     * 口径与出餐屏/工作台一致：待做取活跃单（不落小票），已做按送达时间归今日。
     */
    async prepSummary(ctx: RequestContext): Promise<MerchantPrepItem[]> {
        const repo = this.connection.getRepository(ctx, Order);
        const todoOrders = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.hallStatus IN ('pending_merchant','accepted')")
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .getMany();
        const startOfDay = new Date(startOfCampusDay(Date.now()));
        const doneOrders = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.deliveryStatus = 'delivered'")
            .andWhere('order.customFields.deliveredAt >= :start', { start: startOfDay })
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .getMany();

        type Acc = { pending: number; cooking: number; done: number; addons: Map<string, number> };
        const acc = new Map<string, Acc>();
        const bump = (o: Order, field: 'pending' | 'cooking' | 'done') => {
            for (const l of o.lines ?? []) {
                const name = l.productVariant?.name ?? '';
                if (!name) continue;
                const cur = acc.get(name) ?? { pending: 0, cooking: 0, done: 0, addons: new Map<string, number>() };
                cur[field] += l.quantity;
                const addonsText = addonDisplayText((l.customFields as any)?.waimaiAddons);
                if (addonsText) {
                    for (const opt of addonsText.split(' / ')) {
                        if (!opt) continue;
                        cur.addons.set(opt, (cur.addons.get(opt) ?? 0) + l.quantity);
                    }
                }
                acc.set(name, cur);
            }
        };
        for (const o of todoOrders) bump(o, (o.customFields as any).hallStatus === 'accepted' ? 'cooking' : 'pending');
        for (const o of doneOrders) bump(o, 'done');

        return [...acc.entries()]
            .map(([name, v]) => ({
                name,
                pendingQty: v.pending,
                cookingQty: v.cooking,
                doneQty: v.done,
                todoQty: v.pending + v.cooking,
                totalQty: v.pending + v.cooking + v.done,
                addons: [...v.addons.entries()].map(([n, q]) => ({ name: n, quantity: q })),
            }))
            // 待做多的排前面（后厨优先看今天还要做多少），其次按今日总量、名称
            .sort((a, b) => b.todoQty - a.todoQty || b.totalQty - a.totalQty || a.name.localeCompare(b.name));
    }

    /** 营业日报（§80）：单日经营快照 —— KPI、时段分布、商品 Top5、对比昨日与近 7 日均值 */
    async dailyReport(ctx: RequestContext, date?: string | null): Promise<MerchantDailyReport> {
        const DAY_MS = 24 * 3600_000;
        const now = Date.now();
        const today0 = startOfCampusDay(now);
        const raw = String(date ?? '').trim();
        let day0 = today0;
        if (raw) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(raw).getTime())) {
                throw new UserInputError('日期格式不合法（YYYY-MM-DD）');
            }
            day0 = startOfCampusDay(new Date(raw).getTime());
            if (day0 > today0) throw new UserInputError('不能查看未来日期的营业日报');
            if (day0 < today0 - 29 * DAY_MS) throw new UserInputError('营业日报最多回看 30 天');
        }
        const dayKey = campusDayKey(day0);
        const prevKey = campusDayKey(day0 - DAY_MS);
        const isToday = day0 === today0;

        // 一次查询覆盖「当日 + 前 7 日」，避免多次往返
        const orders = await this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            .andWhere('order.createdAt >= :since', { since: new Date(day0 - 7 * DAY_MS) })
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .getMany();

        const hourCount = isToday ? campusHour(now) + 1 : 24;
        const hourly: MerchantDailyHour[] = Array.from({ length: hourCount }, (_, h) => ({ hour: h, orders: 0, gross: 0 }));
        const products = new Map<string, MerchantDailyProduct>();
        let ordersCur = 0;
        let grossCur = 0;
        let cancelled = 0;
        let cancelledAmount = 0;
        const prev: MerchantDailyCompare = { orders: 0, gross: 0, avgTicket: 0 };
        let sum7Orders = 0;
        let sum7Gross = 0;

        for (const o of orders) {
            const cf = o.customFields as any;
            const total = o.totalWithTax ?? 0;
            if (o.state === 'Cancelled') {
                // 取消单按下单日归日（与经营设置页营收口径一致）
                if (campusDayKey(new Date(o.createdAt).getTime()) === dayKey) {
                    cancelled += 1;
                    cancelledAmount += total;
                }
                continue;
            }
            if (cf.deliveryStatus !== 'delivered' || !cf.deliveredAt) continue;
            // 营业额按送达时间归日：跨零点订单计入实际送达当天
            const doneAt = new Date(cf.deliveredAt).getTime();
            const doneKey = campusDayKey(doneAt);
            if (doneKey === dayKey) {
                ordersCur += 1;
                grossCur += total;
                const h = campusHour(doneAt);
                if (h < hourly.length) {
                    hourly[h].orders += 1;
                    hourly[h].gross += total;
                }
                for (const l of o.lines ?? []) {
                    const name = l.productVariant?.name ?? '';
                    if (!name) continue;
                    const cur = products.get(name) ?? { name, qty: 0, amount: 0 };
                    cur.qty += l.quantity;
                    cur.amount += l.linePriceWithTax ?? 0;
                    products.set(name, cur);
                }
            } else if (doneKey === prevKey) {
                prev.orders += 1;
                prev.gross += total;
            }
            if (doneAt >= day0 - 7 * DAY_MS && doneAt < day0) {
                sum7Orders += 1;
                sum7Gross += total;
            }
        }

        prev.avgTicket = prev.orders ? Math.round(prev.gross / prev.orders) : 0;
        return {
            date: dayKey,
            orders: ordersCur,
            gross: grossCur,
            avgTicket: ordersCur ? Math.round(grossCur / ordersCur) : 0,
            cancelled,
            cancelledAmount,
            hourly,
            topProducts: [...products.values()]
                .sort((a, b) => b.qty - a.qty || b.amount - a.amount || a.name.localeCompare(b.name))
                .slice(0, 5),
            prev,
            // 近 7 日均值：单量/营业额按 7 天均摊，客单价用 7 日整体客单价
            last7Avg: {
                orders: Math.round(sum7Orders / 7),
                gross: Math.round(sum7Gross / 7),
                avgTicket: sum7Orders ? Math.round(sum7Gross / sum7Orders) : 0,
            },
        };
    }

    /** 售后申请清单（§81）：只列本店渠道订单的售后单；state 为空=全部 */
    async afterSalesList(
        ctx: RequestContext,
        state?: string | null,
        opts: MerchantAfterSalesListOptions = {},
    ): Promise<MerchantAfterSalesList> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        // 渠道隔离：售后单本身挂了 channels，但其归属以订单渠道为准（售后单可能由平台代建）
        const scoped = () => repo.createQueryBuilder('a')
            .leftJoin('a.order', 'o')
            .leftJoin('o.channels', 'c')
            .where('c.id = :ch', { ch: ctx.channelId as any })
            .andWhere('o.customFields.hallStatus IS NOT NULL');

        const { from, to } = this.afterSalesRange(opts);
        /** 追加非 state 筛选条件（原地修改并返回，保持 QueryBuilder 类型以便 getMany 正常推断） */
        const applyFilters = (target: ReturnType<typeof scoped>) => {
            const type = String(opts.type ?? '').trim();
            if (type) target.andWhere('a.type = :tp', { tp: type });
            const code = String(opts.orderCode ?? '').trim();
            if (code) target.andWhere('o.code ILIKE :code', { code: `%${code}%` });
            if (from) target.andWhere('a.createdAt >= :from', { from });
            if (to) target.andWhere('a.createdAt < :to', { to });
            return target;
        };

        // 状态计数不受 state 筛选影响：入口红点与页签角标口径统一
        const countRows = await scoped()
            .select('a.state', 'state')
            .addSelect('COUNT(*)', 'n')
            .groupBy('a.state')
            .getRawMany<{ state: string; n: string }>();
        const stateCounts: MerchantAfterSalesStateCount[] = countRows
            .map(r => ({ state: String(r.state ?? ''), count: Number(r.n) || 0 }))
            .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
        const pendingCount = stateCounts
            .filter(r => AFTER_SALES_PENDING_STATES.includes(r.state))
            .reduce((s, r) => s + r.count, 0);

        const wanted = String(state ?? '').trim();
        const totalQb = applyFilters(scoped());
        if (wanted) totalQb.andWhere('a.state = :st', { st: wanted });
        const total = await totalQb.getCount();

        const take = Math.min(Math.max(Number(opts.take ?? 50) || 50, 1), 100);
        const skip = Math.max(Number(opts.skip ?? 0) || 0, 0);
        const qb = applyFilters(scoped())
            .leftJoinAndSelect('a.customer', 'customer')
            .orderBy('a.createdAt', 'DESC')
            .skip(skip)
            .take(take);
        if (wanted) qb.andWhere('a.state = :st', { st: wanted });
        const rows = await qb.getMany();

        const counts = await this.afterSalesMessageCounts(ctx, rows.map(r => Number(r.id)));
        const lastSender = await this.afterSalesLastSender(rows.map(r => Number(r.id)));
        const timeoutHours = this.afterSalesTimeoutHours(ctx);
        const now = Date.now();
        return {
            items: rows.map(r => this.toAfterSalesRow(r, counts, timeoutHours, now, lastSender)),
            pendingCount,
            total,
            stateCounts,
            skip,
            take,
        };
    }

    /**
     * 同意售后（§81）：refund_only 由售后插件链式 Received → 退款到账，商家一次操作即闭环；
     * 先按「本店渠道 + 待处理」校验，避免越权或已处理单重复触发退款。
     * 顾客申诉（Rejected → Appealed）后商家仍可同意（appealRequest 已把申诉说明写入留言流）。
     */
    async afterSalesApprove(ctx: RequestContext, id: ID): Promise<MerchantAfterSalesRow> {
        await this.assertChannelAfterSales(ctx, id, AFTER_SALES_PENDING_STATES);
        const svc = this.getAfterSales();
        if (!svc) throw new UserInputError('售后插件未安装，暂不能处理售后申请');
        try {
            await svc.approveRequest(ctx, id);
        } catch (e: any) {
            throw new UserInputError(`同意售后失败：${e?.message ?? e}`);
        }
        return this.afterSalesOne(ctx, id);
    }

    /**
     * 售后详情（§81）：售后单 + 协商留言（含顾客申诉说明）+ 状态时间线 + 退款失败留痕。
     * 渠道隔离同列表；留言表缺失时降级为空列表，不影响详情可用。
     */
    async afterSalesDetail(ctx: RequestContext, id: ID): Promise<MerchantAfterSalesDetail> {
        const request = await this.assertChannelAfterSales(ctx, id, []);
        const counts = await this.afterSalesMessageCounts(ctx, [Number(request.id)]);
        const lastSender = await this.afterSalesLastSender([Number(request.id)]);
        const timeoutHours = this.afterSalesTimeoutHours(ctx);
        const messages = await this.afterSalesMessageRows(Number(request.id));
        const stateHistory = await this.afterSalesHistoryRows(Number(request.id));
        const order = request.order as any;
        const customer = request.customer as any;
        const addr = order?.shippingAddress ?? null;
        return {
            request: this.toAfterSalesRow(request, counts, timeoutHours, Date.now(), lastSender),
            messages,
            messageTotal: counts.get(Number(request.id)) ?? messages.length,
            stateHistory,
            refundError: request.refundError ?? null,
            actualRefundAmount: request.actualRefundAmount == null ? null : Number(request.actualRefundAmount),
            timeoutHours,
            customerPhone: customer?.phoneNumber ?? null,
            shippingAddress: addr
                ? {
                    fullName: [addr.fullName, addr.company].filter(Boolean).join(' / ') || String(addr.fullName ?? ''),
                    phoneNumber: String(addr.phoneNumber ?? ''),
                    address: [addr.streetLine1, addr.streetLine2, addr.postalCode]
                        .filter(Boolean)
                        .join(' '),
                }
                : null,
            orderItems: await this.afterSalesOrderItems(Number(order?.id ?? request.orderId)),
            orderTotal: Number(order?.totalWithTax ?? 0),
        };
    }

    /**
     * 商家确认收到退货（§82）：Returning → Received，退货回补与退款收紧由售后插件同事务完成。
     * 收货备注先写留言流（失败只告警，不阻断收货）。
     */
    async afterSalesConfirmReturn(
        ctx: RequestContext,
        id: ID,
        receivedQuantity?: number | null,
        note?: string | null,
    ): Promise<MerchantAfterSalesRow> {
        await this.assertChannelAfterSales(ctx, id, ['Returning']);
        const svc = this.getAfterSales();
        if (!svc) throw new UserInputError('售后插件未安装，暂不能处理售后申请');
        const qty = receivedQuantity == null ? undefined : Math.max(0, Math.floor(Number(receivedQuantity)));
        const remark = String(note ?? '').trim();
        try {
            if (remark) {
                try {
                    await svc.addMessage(ctx, id, 'admin', remark.slice(0, 500));
                } catch (e: any) {
                    Logger.warn(`确认收货备注写入留言失败: ${e?.message ?? e}`, 'CampusMerchantAfterSales');
                }
            }
            await svc.confirmReceive(ctx, id, qty);
        } catch (e: any) {
            throw new UserInputError(`确认收货失败：${e?.message ?? e}`);
        }
        return this.afterSalesOne(ctx, id);
    }

    /**
     * 售后退款失败重试（§82）：仅 RefundFailed 可重试，复用售后插件退款核心（按剩余可退额度继续退）。
     * 30 秒内同单只放行一次，避免连点造成重复退款尝试。
     */
    async afterSalesRetryRefund(ctx: RequestContext, id: ID): Promise<MerchantAfterSalesRow> {
        await this.assertChannelAfterSales(ctx, id, ['RefundFailed']);
        const key = Number(id);
        const now = Date.now();
        if (now - (this.refundRetryAt.get(key) ?? 0) < 30_000) {
            throw new UserInputError('退款重试过于频繁，请 30 秒后再试');
        }
        this.refundRetryAt.set(key, now);
        // 防内存增长：清理 1 分钟前的记录
        if (this.refundRetryAt.size > 500) {
            for (const [k, t] of this.refundRetryAt) {
                if (now - t > 60_000) this.refundRetryAt.delete(k);
            }
        }
        const svc = this.getAfterSales();
        if (!svc) throw new UserInputError('售后插件未安装，暂不能处理售后申请');
        try {
            await svc.retryRefund(ctx, id);
        } catch (e: any) {
            throw new UserInputError(`退款重试失败：${e?.message ?? e}`);
        }
        return this.afterSalesOne(ctx, id);
    }

    /** 商家协商留言（§82）：仅待处理/顾客申诉单可回复，已退款、已驳回、已关闭一律只读 */
    async afterSalesReply(
        ctx: RequestContext,
        id: ID,
        content: string,
        images?: string[] | null,
    ): Promise<MerchantAfterSalesMessage> {
        const request = await this.assertChannelAfterSales(ctx, id, []);
        if (!AFTER_SALES_PENDING_STATES.includes(request.state)) {
            throw new UserInputError('该售后已结束，不能再回复');
        }
        const svc = this.getAfterSales();
        if (!svc) throw new UserInputError('售后插件未安装，暂不能留言');
        try {
            const msg = await svc.addMessage(ctx, id, 'admin', String(content ?? ''), images ?? null);
            return {
                id: String(msg.id),
                senderType: String(msg.senderType),
                senderName: String(msg.senderName),
                content: String(msg.content),
                images: Array.isArray(msg.images) ? msg.images : [],
                createdAt: msg.createdAt,
            };
        } catch (e: any) {
            throw new UserInputError(`留言失败：${e?.message ?? e}`);
        }
    }

    /** 售后处理统计（§81）：入口红点 + 超时 + 今日处理量/退款额（今日按校园日 UTC+8 切分） */
    async afterSalesStats(ctx: RequestContext): Promise<MerchantAfterSalesStats> {
        const timeoutHours = this.afterSalesTimeoutHours(ctx);
        const now = Date.now();
        const dayStart = new Date(startOfCampusDay(now));
        const dayEnd = new Date(startOfCampusDay(now) + 24 * 3600_000);
        const overdueBefore = new Date(now - timeoutHours * 3600_000);
        const raw = this.connection.rawConnection;
        const chId = Number(ctx.channelId);
        // 渠道隔离：售后单回落到订单，再用订单-渠道关联表判定归属
        const scope = 'EXISTS (SELECT 1 FROM "order" o JOIN order_channels_channel oc ON oc."orderId" = o.id '
            + 'AND oc."channelId" = $1 WHERE o.id = a."orderId" AND o."customFieldsHallstatus" IS NOT NULL)';

        const pendingRows: any[] = await raw.query(
            `SELECT COUNT(*) FILTER (WHERE a.state IN ('Pending', 'Appealed')) AS "pending",
                    COUNT(*) FILTER (WHERE a.state = 'Pending' AND a."createdAt" <= $2) AS "overdue"
               FROM after_sales_request a WHERE ${scope}`,
            [chId, overdueBefore],
        );
        const handledRows: any[] = await raw.query(
            `SELECT COUNT(DISTINCT h."requestId") AS "n"
               FROM after_sales_state_history h
               JOIN after_sales_request a ON a.id = h."requestId"
              WHERE h."createdAt" >= $2 AND h."createdAt" < $3
                AND h."toState" IN ('Approved', 'Rejected', 'Refunded')
                AND ${scope}`,
            [chId, dayStart, dayEnd],
        );
        const refundRows: any[] = await raw.query(
            `SELECT COUNT(*) AS "n",
                    COALESCE(SUM(COALESCE(a."actualRefundAmount", a."refundAmount")), 0) AS "amount"
               FROM after_sales_request a
              WHERE a.state = 'Refunded' AND a."refundedAt" >= $2 AND a."refundedAt" < $3
                AND ${scope}`,
            [chId, dayStart, dayEnd],
        );
        // 待回复：每单最后一条留言来自顾客（与列表 unread 同口径）
        let pendingReply = 0;
        try {
            const replyRows: any[] = await raw.query(
                `SELECT COUNT(*) AS "n" FROM after_sales_request a
                  WHERE ${scope}
                    AND (SELECT m."senderType" FROM after_sales_message m
                          WHERE m."requestId" = a.id ORDER BY m."createdAt" DESC LIMIT 1) = 'customer'`,
                [chId],
            );
            pendingReply = Number(replyRows?.[0]?.n ?? 0);
        } catch {
            // 留言表缺失时视为无待回复
        }
        return {
            pending: Number(pendingRows?.[0]?.pending ?? 0),
            overdue: Number(pendingRows?.[0]?.overdue ?? 0),
            timeoutHours,
            todayHandled: Number(handledRows?.[0]?.n ?? 0),
            todayRefunded: Number(refundRows?.[0]?.n ?? 0),
            todayRefundAmount: Number(refundRows?.[0]?.amount ?? 0),
            pendingReply,
        };
    }

    /** 申请时间区间：纯日期按校园日（UTC+8）切分，to 含当天；非法格式直接拒绝 */
    private afterSalesRange(opts: MerchantAfterSalesListOptions): { from: Date | null; to: Date | null } {
        const DAY_MS = 24 * 3600_000;
        const parse = (input: string, endOfDay: boolean): number | null => {
            const text = input.trim();
            if (!text) return null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                const dayStart = startOfCampusDay(new Date(text).getTime());
                if (Number.isNaN(dayStart)) throw new UserInputError('申请时间格式不合法（YYYY-MM-DD）');
                return endOfDay ? dayStart + DAY_MS : dayStart;
            }
            const t = new Date(text).getTime();
            if (Number.isNaN(t)) throw new UserInputError('申请时间格式不合法');
            return t;
        };
        const fromT = parse(String(opts.from ?? ''), false);
        const toT = parse(String(opts.to ?? ''), true);
        if (fromT != null && toT != null && fromT >= toT) throw new UserInputError('结束时间必须晚于开始时间');
        return { from: fromT == null ? null : new Date(fromT), to: toT == null ? null : new Date(toT) };
    }

    /** 渠道售后处理时限（小时）：afterSalesTimeoutHours，未配置按售后插件默认 48 */
    private afterSalesTimeoutHours(ctx: RequestContext): number {
        const cf = ((ctx.channel as any)?.customFields ?? {}) as any;
        const n = Number(cf.afterSalesTimeoutHours ?? 48);
        return Number.isFinite(n) && n >= 0 ? n : 48;
    }

    /** 驳回售后（§81）：理由必填（顾客在 C 端可见），仅 Pending 可驳回 */
    async afterSalesReject(ctx: RequestContext, id: ID, reason: string): Promise<MerchantAfterSalesRow> {
        const text = String(reason ?? '').trim();
        if (!text) throw new UserInputError('请填写驳回理由（顾客可见）');
        if (text.length > 200) throw new UserInputError('驳回理由最多 200 字');
        await this.assertChannelAfterSales(ctx, id, ['Pending']);
        const svc = this.getAfterSales();
        if (!svc) throw new UserInputError('售后插件未安装，暂不能处理售后申请');
        try {
            await svc.rejectRequest(ctx, id, text);
        } catch (e: any) {
            throw new UserInputError(`驳回售后失败：${e?.message ?? e}`);
        }
        return this.afterSalesOne(ctx, id);
    }

    /** 售后单必须属于当前店铺，且状态在允许集合内（空集合=不校验状态） */
    private async assertChannelAfterSales(ctx: RequestContext, id: ID, expects: string[]) {
        const request = await this.connection.getRepository(ctx, AfterSalesRequest).findOne({
            where: { id: id as any },
            relations: { order: { channels: true }, channels: true, customer: true } as any,
        });
        const inChannel = request?.channels?.some(c => String(c.id) === String(ctx.channelId))
            || request?.order?.channels?.some?.((c: any) => String(c.id) === String(ctx.channelId));
        if (!request || !inChannel) throw new UserInputError('售后单不存在或不属于当前店铺');
        if (expects.length && !expects.includes(request.state)) {
            throw new UserInputError('该售后申请已处理，不能重复操作');
        }
        return request;
    }

    private async afterSalesOne(ctx: RequestContext, id: ID): Promise<MerchantAfterSalesRow> {
        const row = await this.connection.getRepository(ctx, AfterSalesRequest).findOne({
            where: { id: id as any },
            relations: { order: true, customer: true } as any,
        });
        if (!row) throw new UserInputError('售后单不存在');
        const counts = await this.afterSalesMessageCounts(ctx, [Number(row.id)]);
        const lastSender = await this.afterSalesLastSender([Number(row.id)]);
        return this.toAfterSalesRow(row, counts, this.afterSalesTimeoutHours(ctx), Date.now(), lastSender);
    }

    /** 协商留言列表（正序，最多 100 条）：插件表缺失时降级为空，不影响详情可用 */
    private async afterSalesMessageRows(requestId: number): Promise<MerchantAfterSalesMessage[]> {
        try {
            const rows: any[] = await this.connection.rawConnection.query(
                'SELECT id, "senderType", "senderName", content, images, "createdAt" FROM after_sales_message '
                + 'WHERE "requestId" = $1 ORDER BY "createdAt" ASC LIMIT 100',
                [requestId],
            );
            return (Array.isArray(rows) ? rows : []).map(r => {
                // images 为 simple-json 列（多数驱动返回字符串），兼容对象直出
                let images: string[] = [];
                if (Array.isArray(r.images)) {
                    images = r.images;
                } else if (typeof r.images === 'string') {
                    try {
                        const parsed = JSON.parse(r.images);
                        if (Array.isArray(parsed)) images = parsed;
                    } catch {
                        images = [];
                    }
                }
                return {
                    id: String(r.id),
                    senderType: String(r.senderType ?? ''),
                    senderName: String(r.senderName ?? ''),
                    content: String(r.content ?? ''),
                    images,
                    createdAt: new Date(r.createdAt),
                };
            });
        } catch {
            return [];
        }
    }

    /** 状态流转时间线（正序，最多 50 条）：历史表缺失时降级为空 */
    private async afterSalesHistoryRows(requestId: number): Promise<MerchantAfterSalesHistoryRow[]> {
        try {
            const rows: any[] = await this.connection.rawConnection.query(
                'SELECT "fromState", "toState", "createdAt" FROM after_sales_state_history '
                + 'WHERE "requestId" = $1 ORDER BY "createdAt" ASC LIMIT 50',
                [requestId],
            );
            return (Array.isArray(rows) ? rows : []).map(r => ({
                fromState: r.fromState == null ? null : String(r.fromState),
                toState: String(r.toState ?? ''),
                createdAt: new Date(r.createdAt),
            }));
        } catch {
            return [];
        }
    }

    /** 每单最新留言发送方（批量）：用于 unread 标记（最新为 customer 即待商家回复） */
    private async afterSalesLastSender(ids: number[]): Promise<Map<number, string>> {
        const out = new Map<number, string>();
        const list = ids.filter(n => Number.isFinite(n) && n > 0);
        if (!list.length) return out;
        try {
            const rows: any = await this.connection.rawConnection.query(
                'SELECT DISTINCT ON ("requestId") "requestId", "senderType" FROM after_sales_message '
                + 'WHERE "requestId" = ANY($1::int[]) ORDER BY "requestId", "createdAt" DESC',
                [list],
            );
            for (const r of Array.isArray(rows) ? rows : []) {
                out.set(Number(r.requestId), String(r.senderType ?? ''));
            }
        } catch {
            return out;
        }
        return out;
    }

    /** 订单商品行（售后详情）：商品名优先取变体中文翻译，缺失回落商品翻译 */
    private async afterSalesOrderItems(orderId: number): Promise<MerchantAfterSalesLine[]> {
        if (!Number.isFinite(orderId) || orderId <= 0) return [];
        try {
            const rows: any = await this.connection.rawConnection.query(
                'SELECT COALESCE(pvt.name, pt.name, \'商品\') AS name, '
                + 'ol."quantity"::int AS quantity, ol."unitPriceWithTax"::int AS "unitPrice" '
                + 'FROM order_line ol '
                + 'JOIN product_variant pv ON pv.id = ol."productVariantId" '
                + 'LEFT JOIN product_variant_translation pvt ON pvt."baseId" = pv.id AND pvt."languageCode" = \'zh_Hans\' '
                + 'LEFT JOIN product p ON p.id = pv."productId" '
                + 'LEFT JOIN product_translation pt ON pt."baseId" = p.id AND pt."languageCode" = \'zh_Hans\' '
                + 'WHERE ol."orderId" = $1 ORDER BY ol.id ASC',
                [orderId],
            );
            return (Array.isArray(rows) ? rows : []).map(r => ({
                name: String(r.name ?? '商品'),
                quantity: Number(r.quantity) || 0,
                unitPrice: Number(r.unitPrice) || 0,
            }));
        } catch {
            return [];
        }
    }

    /** 协商留言条数（批量）：插件表缺失时降级为 0，不影响清单可用 */
    private async afterSalesMessageCounts(ctx: RequestContext, ids: number[]): Promise<Map<number, number>> {
        const out = new Map<number, number>();
        const list = ids.filter(n => Number.isFinite(n) && n > 0);
        if (!list.length) return out;
        try {
            const rows: any = await this.connection.rawConnection.query(
                'SELECT "requestId", COUNT(*)::int AS n FROM after_sales_message '
                + 'WHERE "requestId" = ANY($1::int[]) GROUP BY "requestId"',
                [list],
            );
            for (const r of Array.isArray(rows) ? rows : []) out.set(Number(r.requestId), Number(r.n) || 0);
        } catch {
            return out;
        }
        return out;
    }

    private toAfterSalesRow(
        row: AfterSalesRequest,
        counts: Map<number, number>,
        timeoutHours: number,
        now: number,
        lastSender: Map<number, string>,
    ): MerchantAfterSalesRow {
        const customer = row.customer as any;
        const order = row.order as any;
        return {
            id: String(row.id),
            orderId: String(row.orderId ?? ''),
            orderCode: order?.code ?? '',
            state: String(row.state ?? ''),
            type: String(row.type ?? ''),
            reason: String(row.reason ?? ''),
            description: row.description ?? null,
            refundAmount: Number(row.refundAmount ?? 0),
            rejectReason: row.rejectReason ?? null,
            evidenceImages: Array.isArray(row.evidenceImages) ? row.evidenceImages : [],
            messageCount: counts.get(Number(row.id)) ?? 0,
            customerName: customer
                ? [customer.firstName, customer.lastName].filter(Boolean).join('') || null
                : null,
            createdAt: row.createdAt,
            refundedAt: row.refundedAt ?? null,
            // 超时口径与售后插件 PENDING_REMIND 一致：仅 Pending 按申请时间计时
            overdue: row.state === 'Pending'
                && new Date(row.createdAt).getTime() + timeoutHours * 3600_000 <= now,
            // 未读=最后一条留言由顾客发出（商家回完即消失），无需额外已读表
            unread: lastSender.get(Number(row.id)) === 'customer',
        };
    }

    /** 一键沽清：商品列表（本渠道），带售罄标记与规格数（搜索按名称模糊） */
    async products(ctx: RequestContext, search?: string, skip?: number, take?: number) {
        const q = String(search ?? '').trim();
        const safeSkip = Math.max(0, Number(skip ?? 0) || 0);
        const safeTake = Math.min(Math.max(Number(take ?? 50) || 50, 1), 200);
        const rows: any = await this.connection.rawConnection.query(
            'SELECT p.id AS "productId", COALESCE(pt.name, \'商品 #\' || p.id) AS name, '
            + 'COALESCE(p."customFieldsWaimaisoldout", false) AS "soldOut", '
            + 'COALESCE(p."customFieldsWaimaimonthlysales", 0) AS "monthlySales", '
            + 'p."customFieldsWaimaipackingfee" AS "packingFee", '
            + 'p."customFieldsWaimaiaddongroups" AS "addonGroups", '
            + 'p."customFieldsWaimaicombo" AS "combo", '
            + 'p."customFieldsWaimaidailylimit" AS "dailyLimit", '
            + 'p."customFieldsWaimaiperuserlimit" AS "perUserLimit", '
            + '(SELECT COUNT(*)::int FROM product_variant pv WHERE pv."productId" = p.id AND pv."deletedAt" IS NULL) AS "variantCount" '
            + 'FROM product p '
            + 'JOIN product_channels_channel pc ON pc."productId" = p.id AND pc."channelId" = $1 '
            + 'LEFT JOIN LATERAL (SELECT name FROM product_translation pt WHERE pt."baseId" = p.id '
            + 'ORDER BY (pt."languageCode" = \'zh_Hans\') DESC LIMIT 1) pt ON true '
            + 'WHERE ($2 = \'\' OR pt.name ILIKE \'%\' || $2 || \'%\') '
            + 'ORDER BY p.id DESC LIMIT $3 OFFSET $4',
            [ctx.channelId, q, safeTake, safeSkip],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const countRows: any = await this.connection.rawConnection.query(
            'SELECT COUNT(*)::int AS n FROM product p '
            + 'JOIN product_channels_channel pc ON pc."productId" = p.id AND pc."channelId" = $1 '
            + 'LEFT JOIN LATERAL (SELECT name FROM product_translation pt WHERE pt."baseId" = p.id '
            + 'ORDER BY (pt."languageCode" = \'zh_Hans\') DESC LIMIT 1) pt ON true '
            + 'WHERE ($2 = \'\' OR pt.name ILIKE \'%\' || $2 || \'%\')',
            [ctx.channelId, q],
        );
        const countList = Array.isArray(countRows) && Array.isArray(countRows[0]) ? countRows[0] : countRows;
        // 当日已售（§68）：仅商品列表这一页涉及的商品，限量商品才展示剩余
        const ids = (list ?? []).map((r: any) => Number(r.productId)).filter((n: number) => Number.isFinite(n));
        const soldMap = await queryDailySold(this.connection.rawConnection, Number(ctx.channelId), ids);
        return {
            items: (list ?? []).map((r: any) => ({
                productId: r.productId,
                name: r.name,
                soldOut: Boolean(r.soldOut),
                monthlySales: Number(r.monthlySales ?? 0),
                variantCount: Number(r.variantCount ?? 0),
                packingFee: r.packingFee == null ? null : Number(r.packingFee),
                // 加料组/套餐以 JSON 字符串回传，后台编辑 sheet 直接反序列化回填
                addonGroups: r.addonGroups == null ? null : String(r.addonGroups),
                combo: r.combo == null ? null : String(r.combo),
                dailyLimit: normalizeLimit(r.dailyLimit),
                perUserLimit: normalizeLimit(r.perUserLimit),
                soldToday: soldMap.get(Number(r.productId)) ?? 0,
                remaining: remainingOf(normalizeLimit(r.dailyLimit), soldMap.get(Number(r.productId)) ?? 0),
            })),
            total: Number(countList?.[0]?.n ?? 0),
        };
    }

    /** 沽清开关：售罄仍展示、不可加购；下单前置闸门二次校验 */
    async setProductSoldOut(ctx: RequestContext, productId: ID, soldOut: boolean) {
        const inChannel = await this.connection.getRepository(ctx, Product).createQueryBuilder('product')
            .leftJoin('product.channels', 'channel')
            .where('product.id = :id', { id: productId as any })
            .andWhere('channel.id = :ch', { ch: ctx.channelId as any })
            .getOne();
        if (!inChannel) throw new UserInputError('商品不存在或不属于当前店铺');
        await this.connection.getRepository(ctx, Product).update(productId, {
            customFields: { waimaiSoldOut: Boolean(soldOut) },
        } as any);
        // 手动开关即代表「非全店沽清批次」：清掉批次登记，次日自动恢复不再动它
        await this.clearSoldOutBatch(ctx, { productId: productId as any });
        return { ok: true, soldOut: Boolean(soldOut) };
    }

    /** 全店批量沽清 / 批量恢复：仅本渠道未删除商品，返回实际影响条数（打烊后一键恢复用） */
    async setAllProductsSoldOut(ctx: RequestContext, soldOut: boolean) {
        const flag = Boolean(soldOut);
        // 标识更新与批次登记必须同一事务：否则批次写入失败会留下「已沽清但次日不会被自动恢复」的商品
        const ids = await this.connection.rawConnection.transaction(async manager => {
            const rows: any = await manager.query(
                'UPDATE product p SET "customFieldsWaimaisoldout" = $2 '
                + 'FROM product_channels_channel pc '
                + 'WHERE pc."productId" = p.id AND pc."channelId" = $1 '
                + 'AND p."deletedAt" IS NULL '
                + 'RETURNING p.id',
                [ctx.channelId, flag],
            );
            const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
            const changed: number[] = (Array.isArray(list) ? list : []).map((r: any) => Number(r.id));
            if (flag) {
                // 登记批次：仅供次日 04:00 自动恢复命中这些商品
                if (changed.length) {
                    await manager.query(
                        'INSERT INTO campus_soldout_batch ("channelId", "productId") '
                        + 'SELECT $1, unnest($2::int[]) '
                        + 'ON CONFLICT ("channelId", "productId") DO NOTHING',
                        [ctx.channelId, changed],
                    );
                }
            } else {
                await manager.query(
                    'DELETE FROM campus_soldout_batch WHERE "channelId" = $1',
                    [ctx.channelId],
                );
            }
            return changed;
        });
        return { ok: true, soldOut: flag, count: ids.length };
    }

    /** 清除全店沽清批次登记（传 productId 只清该商品） */
    async clearSoldOutBatch(ctx: RequestContext, opts: { productId?: number }) {
        if (opts.productId != null) {
            await this.connection.rawConnection.query(
                'DELETE FROM campus_soldout_batch WHERE "channelId" = $1 AND "productId" = $2',
                [ctx.channelId, opts.productId],
            );
            return;
        }
        await this.connection.rawConnection.query(
            'DELETE FROM campus_soldout_batch WHERE "channelId" = $1',
            [ctx.channelId],
        );
    }

    /** 沽清自动恢复开关 + 待恢复件数（后台开关与文案用）；开关列由 §66 迁移补，不在 customFields 声明（避免 schema sync 并发加列失败） */
    async getSoldOutAutoRestore(ctx: RequestContext) {
        const rows: any = await this.connection.rawConnection.query(
            'SELECT "customFieldsWaimaisoldoutautorestore" AS enabled FROM channel WHERE id = $1',
            [ctx.channelId],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const enabled = Array.isArray(list) && list.length ? list[0]?.enabled !== false : true;
        const pending = await this.countSoldOutBatch(ctx.channelId);
        return { enabled, pending };
    }

    async setSoldOutAutoRestore(ctx: RequestContext, enabled: boolean) {
        await this.connection.rawConnection.query(
            'UPDATE channel SET "customFieldsWaimaisoldoutautorestore" = $2 WHERE id = $1',
            [ctx.channelId, Boolean(enabled)],
        );
        const pending = await this.countSoldOutBatch(ctx.channelId);
        return { enabled: Boolean(enabled), pending };
    }

    private async countSoldOutBatch(channelId: ID): Promise<number> {
        const rows: any = await this.connection.rawConnection.query(
            'SELECT COUNT(*)::int AS n FROM campus_soldout_batch WHERE "channelId" = $1',
            [channelId],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        return Number(Array.isArray(list) ? list[0]?.n ?? 0 : 0) || 0;
    }

    /** 商品级打包费（分/件）：null 清除回落店铺配置；仅本渠道商品可改 */
    async setProductPackingFee(ctx: RequestContext, productId: ID, packingFee: number | null) {
        const inChannel = await this.connection.getRepository(ctx, Product).createQueryBuilder('product')
            .leftJoin('product.channels', 'channel')
            .where('product.id = :id', { id: productId as any })
            .andWhere('channel.id = :ch', { ch: ctx.channelId as any })
            .getOne();
        if (!inChannel) throw new UserInputError('商品不存在或不属于当前店铺');
        let value: number | null = null;
        if (packingFee != null) {
            const n = Number(packingFee);
            if (!Number.isFinite(n) || n < 0) throw new UserInputError('打包费必须为不小于 0 的数字（分/件）');
            if (n > 100_000) throw new UserInputError('打包费单件超出允许上限（100000 分 = 1000 元）');
            value = Math.round(n);
        }
        await this.connection.getRepository(ctx, Product).update(productId, {
            customFields: { waimaiPackingFee: value },
        } as any);
        return { ok: true, packingFee: value };
    }

    /** 每日限量 / 每人限购（§68）：null 或 0 = 不限；每人限购不得大于每日限量 */
    async setProductLimit(
        ctx: RequestContext,
        productId: ID,
        dailyLimit: number | null,
        perUserLimit: number | null,
    ) {
        await this.assertProductInChannel(ctx, productId);
        const daily = normalizeLimit(dailyLimit);
        const perUser = normalizeLimit(perUserLimit);
        for (const v of [dailyLimit, perUserLimit]) {
            if (v != null && Number(v) > DAILY_LIMIT_MAX) {
                throw new UserInputError(`限量最多 ${DAILY_LIMIT_MAX} 份`);
            }
            if (v != null && Number(v) < 0) {
                throw new UserInputError('限量不能为负数');
            }
        }
        if (daily != null && perUser != null && perUser > daily) {
            throw new UserInputError('每人限购不能大于每日限量');
        }
        await this.connection.getRepository(ctx, Product).update(productId, {
            customFields: { waimaiDailyLimit: daily, waimaiPerUserLimit: perUser },
        } as any);
        const soldMap = await queryDailySold(this.connection.rawConnection, Number(ctx.channelId), [Number(productId)]);
        const soldToday = soldMap.get(Number(productId)) ?? 0;
        return {
            ok: true,
            dailyLimit: daily,
            perUserLimit: perUser,
            soldToday,
            remaining: remainingOf(daily, soldToday),
        };
    }

    /** 商品加料组（P1-2）：空数组=清除；清洗后再序列化，脏数据不入库 */
    async setProductAddonGroups(ctx: RequestContext, productId: ID, rawGroups: unknown) {
        await this.assertProductInChannel(ctx, productId);
        const cleaned = parseAddonGroups(rawGroups);
        // 显式上限校验：解析器会静默截断，这里对「用户确实提交了超限内容」直接报错更友好
        const inputCount = Array.isArray(rawGroups) ? rawGroups.length : 0;
        if (inputCount > ADDON_MAX_GROUPS) {
            throw new UserInputError(`加料组最多 ${ADDON_MAX_GROUPS} 组`);
        }
        for (const g of Array.isArray(rawGroups) ? (rawGroups as any[]) : []) {
            const opts = Array.isArray(g?.options) ? g.options : [];
            if (opts.length > ADDON_MAX_OPTIONS_PER_GROUP) {
                throw new UserInputError(`「${g?.name ?? '加料'}」最多 ${ADDON_MAX_OPTIONS_PER_GROUP} 个选项`);
            }
            for (const o of opts) {
                const n = Number(o?.price ?? 0);
                if (Number.isFinite(n) && n > ADDON_MAX_PRICE_FEN) {
                    throw new UserInputError('单个加料价格不能超过 1000 元');
                }
                if (Number.isFinite(n) && n < 0) {
                    throw new UserInputError('加料价格不能为负数');
                }
            }
            const min = Number(g?.min ?? 0);
            const max = Number(g?.max ?? 0);
            if (min > 0 && max > 0 && min > max) {
                throw new UserInputError('「最少选」不能大于「最多选」');
            }
        }
        const value = serializeAddonGroups(cleaned);
        await this.connection.getRepository(ctx, Product).update(productId, {
            customFields: { waimaiAddonGroups: value },
        } as any);
        return { ok: true, addonGroups: value };
    }

    /** 商品套餐内容（P1-2）：传 null/空 items=清除（非套餐商品） */
    async setProductCombo(ctx: RequestContext, productId: ID, rawCombo: unknown) {
        await this.assertProductInChannel(ctx, productId);
        const inputItems = Array.isArray((rawCombo as any)?.items) ? (rawCombo as any).items : [];
        if (inputItems.length > COMBO_MAX_ITEMS) {
            throw new UserInputError(`套餐内含商品最多 ${COMBO_MAX_ITEMS} 项`);
        }
        const value = serializeCombo(parseCombo(rawCombo));
        await this.connection.getRepository(ctx, Product).update(productId, {
            customFields: { waimaiCombo: value },
        } as any);
        return { ok: true, combo: value };
    }

    /** 商品必须属于当前店铺渠道（越权防护：商家只能改本店商品） */
    private async assertProductInChannel(ctx: RequestContext, productId: ID): Promise<void> {
        const inChannel = await this.connection.getRepository(ctx, Product).createQueryBuilder('product')
            .leftJoin('product.channels', 'channel')
            .where('product.id = :id', { id: productId as any })
            .andWhere('channel.id = :ch', { ch: ctx.channelId as any })
            .getOne();
        if (!inChannel) throw new UserInputError('商品不存在或不属于当前店铺');
    }

    private async assertAnyChannelOrder(ctx: RequestContext, orderId: ID) {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        return order;
    }

    private async assertChannelOrder(ctx: RequestContext, orderId: ID, expect: string) {
        return this.assertChannelOrderState(ctx, orderId, [expect]);
    }

    private async assertChannelOrderState(ctx: RequestContext, orderId: ID, expects: string[]) {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        const hs = (order.customFields as any).hallStatus;
        if (!expects.includes(hs)) {
            throw new UserInputError('当前状态不允许该操作');
        }
        return order;
    }

    /** 组装商家视图 DTO：楼栋名批量查、骑手名批量查，不外泄 admin 内部字段 */
    private async toDto(ctx: RequestContext, orders: Order[]): Promise<MerchantBoardOrder[]> {
        const buildingIds = new Set<string>();
        const riderIds = new Set<number>();
        for (const o of orders) {
            const cf = o.customFields as any;
            if (cf.buildingId) buildingIds.add(String(cf.buildingId));
            if (cf.deliveryStaffId) riderIds.add(Number(cf.deliveryStaffId));
        }
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        const customers = riderIds.size
            ? await this.connection.rawConnection.getRepository('Customer').findByIds([...riderIds])
            : [];
        const riderNames = new Map(
            (customers as any[]).map(c => [String(c.id), c.customFields?.riderRealName ?? '']),
        );
        // 催单「已知晓」时间（§78）：一次批量查，避免逐单查库
        const ackMap = await this.urgeAckMap(ctx, orders.map(o => Number(o.id)));
        return orders.map(o => {
            const cf = o.customFields as any;
            const urgedAt = cf.urgedAt ? new Date(cf.urgedAt) : null;
            return {
                id: String(o.id),
                code: o.code,
                createdAt: o.createdAt,
                total: o.total,
                shipping: o.shipping,
                building: cf.buildingId ? buildingNames.get(String(cf.buildingId)) ?? '' : '',
                zone: cf.campusZone ?? '',
                slotText: cf.deliverySlotText ?? '',
                route: cf.fulfillmentRoute ?? '',
                riderName: cf.deliveryStaffId ? riderNames.get(String(cf.deliveryStaffId)) ?? null : null,
                note: cf.note ?? null,
                printedAt: (cf.waimaiPrintedAt as Date | undefined) ?? null,
                provider: cf.thirdPartyProvider || null,
                thirdPartyNo: cf.thirdPartyNo || null,
                handoverCode: cf.handoverCode || null,
                urged: isUrgePending(cf.urged, urgedAt, ackMap.get(String(o.id)) ?? null),
                urgedAt,
                // 脱敏口径与号码保护一致：11 位保留前 3 后 4，绝不外泄明文
                customerPhone: this.privacy.mask(o.customer?.phoneNumber ?? null),
                lines: (o.lines ?? []).map(l => ({
                    name: l.productVariant?.name ?? '',
                    quantity: l.quantity,
                    price: l.unitPrice,
                })),
            };
        });
    }
}

/** 催单是否仍未处理（§78）：顾客置了 urged 且「已知晓」时间早于最近一次催单（顾客再催会重新变为待处理） */
export function isUrgePending(urged: unknown, urgedAt: Date | null, ackedAt: Date | null): boolean {
    if (urged !== true || !urgedAt) return false;
    return !ackedAt || ackedAt.getTime() < urgedAt.getTime();
}
