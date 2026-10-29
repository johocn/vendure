import { Injectable } from '@nestjs/common';
import {
    Channel,
    ID,
    Order,
    OrderService,
    Product,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { campusDayKey, startOfCampusDay } from './campus-time';
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
    lines: KitchenTicketLine[];
}

export interface KitchenQueue {
    tickets: KitchenTicket[];
    pendingCount: number;
    cookingCount: number;
    lateCount: number;
    warnMinutes: number;
    lateMinutes: number;
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
    ) {}

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
        const tickets: KitchenTicket[] = orders.map(o => {
            const cf = o.customFields as any;
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
        return {
            tickets,
            pendingCount: tickets.filter(t => t.stage === 'pending').length,
            cookingCount: tickets.filter(t => t.stage === 'cooking').length,
            lateCount: tickets.filter(t => t.urgency === 'late').length,
            warnMinutes: KDS_WARN_MINUTES,
            lateMinutes: KDS_LATE_MINUTES,
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

    /** 全店批量沽清 / 批量恢复：仅本渠道商品，返回实际影响条数（打烊后一键恢复用） */
    async setAllProductsSoldOut(ctx: RequestContext, soldOut: boolean) {
        const flag = Boolean(soldOut);
        const rows: any = await this.connection.rawConnection.query(
            'UPDATE product p SET "customFieldsWaimaisoldout" = $2 '
            + 'FROM product_channels_channel pc '
            + 'WHERE pc."productId" = p.id AND pc."channelId" = $1 '
            + 'RETURNING p.id',
            [ctx.channelId, flag],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const ids: number[] = (Array.isArray(list) ? list : []).map((r: any) => Number(r.id));
        if (flag) {
            // 登记批次：仅供次日 04:00 自动恢复命中这些商品
            await this.connection.rawConnection.query(
                'INSERT INTO campus_soldout_batch ("channelId", "productId") '
                + 'SELECT $1, unnest($2::int[]) '
                + 'ON CONFLICT ("channelId", "productId") DO NOTHING',
                [ctx.channelId, ids],
            );
        } else {
            await this.clearSoldOutBatch(ctx, {});
        }
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
        return orders.map(o => {
            const cf = o.customFields as any;
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
