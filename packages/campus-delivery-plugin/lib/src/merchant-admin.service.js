"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantAdminService = exports.KDS_LATE_MINUTES = exports.KDS_WARN_MINUTES = void 0;
exports.isUrgePending = isUrgePending;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_config_service_1 = require("./campus-config.service");
const campus_notify_service_1 = require("./campus-notify.service");
const campus_time_1 = require("./campus-time");
const business_hours_1 = require("./business-hours");
const hall_service_1 = require("./hall.service");
const refund_payment_1 = require("./refund-payment");
const third_party_delivery_service_1 = require("./third-party-delivery.service");
const waimai_store_service_1 = require("./waimai-store.service");
const cloud_print_service_1 = require("./cloud-print.service");
const privacy_number_service_1 = require("./privacy-number.service");
const addon_fee_1 = require("./addon-fee");
const daily_limit_1 = require("./daily-limit");
const auto_accept_1 = require("./auto-accept");
const closure_calendar_1 = require("./closure-calendar");
const batch_orders_1 = require("./batch-orders");
/** 出餐屏超时阈值（分钟）：15 分钟预警、25 分钟催单 */
exports.KDS_WARN_MINUTES = 15;
exports.KDS_LATE_MINUTES = 25;
/**
 * 商家接单工作台（admin-api，CampusMerchant 权限，渠道隔离 = 商家角色绑定渠道）。
 * 状态机（merchantConfirmEnabled 渠道）：支付 → pending_merchant（待商家接单）
 * → accepted（备餐中，campusMerchantAcceptOrder）→ open（出餐完成入大厅，
 * campusMerchantCookingDone）→ 骑手 grabbed/delivering → delivered。
 */
let MerchantAdminService = class MerchantAdminService {
    constructor(connection, config, hall, notify, thirdParty, orderService, privacy, cloud) {
        this.connection = connection;
        this.config = config;
        this.hall = hall;
        this.notify = notify;
        this.thirdParty = thirdParty;
        this.orderService = orderService;
        this.privacy = privacy;
        this.cloud = cloud;
    }
    /** 商家自助经营：门店资料（营业时间/公告/电话/营业状态） */
    async storeProfile(ctx) {
        var _a, _b, _c, _d, _e;
        const cfg = await this.config.getConfig(ctx);
        const channel = await this.connection.getRepository(ctx, core_1.Channel)
            .findOne({ where: { id: ctx.channelId } });
        if (!channel)
            throw new core_1.UserInputError('当前店铺渠道不存在');
        const hours = (_b = ((_a = channel.customFields) !== null && _a !== void 0 ? _a : {}).waimaiBusinessHours) !== null && _b !== void 0 ? _b : null;
        const closureDates = (0, closure_calendar_1.safeClosureDates)(cfg.closureDates);
        const closure = (0, closure_calendar_1.closedToday)(closureDates);
        // 未出餐订单（§71）：休业日提醒商家仍有待接单/备餐中订单需处理；轮询 10s 一次，轻量计数
        const unfinishedOrders = await this.connection.getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere("order.customFields.hallStatus IN ('pending_merchant','accepted')")
            .getCount();
        return {
            storeName: channel.code,
            businessHours: hours,
            storeNotice: (_c = cfg.storeNotice) !== null && _c !== void 0 ? _c : null,
            storePhone: (_d = cfg.storePhone) !== null && _d !== void 0 ? _d : null,
            paused: cfg.paused,
            // 与 C 端 openNow / 下单闸门同口径：营业时段内、未临时休息、且今日不在休业日历
            openNow: (0, business_hours_1.isWithinBusinessHours)(hours) && !cfg.paused && !closure,
            closedToday: !!closure,
            closureNote: (_e = closure === null || closure === void 0 ? void 0 : closure.note) !== null && _e !== void 0 ? _e : null,
            closureDates,
            nextTransition: (0, business_hours_1.nextBusinessTransition)(hours),
            unfinishedOrders,
        };
    }
    /** 商家自助修改门店资料：营业时间走 Channel 自定义字段，公告/电话走履约配置白名单 */
    async updateStore(ctx, input) {
        var _a, _b, _c;
        const patch = {};
        if (input.businessHours !== undefined) {
            const raw = String((_a = input.businessHours) !== null && _a !== void 0 ? _a : '').trim();
            if (raw) {
                if (raw.length > 100)
                    throw new core_1.UserInputError('营业时间不能超过 100 个字符');
                // 必须能被营业时段解析器读懂，否则 C 端展示/下单闸门会误判
                if (!(0, business_hours_1.parseBusinessHours)(raw).length) {
                    throw new core_1.UserInputError('营业时间格式不正确，示例：10:00-22:00 或 10:00-14:00,17:00-21:00');
                }
            }
            const repo = this.connection.getRepository(ctx, core_1.Channel);
            const channel = await repo.findOne({ where: { id: ctx.channelId } });
            if (!channel)
                throw new core_1.UserInputError('当前店铺渠道不存在');
            channel.customFields.waimaiBusinessHours = raw || null;
            await repo.save(channel);
        }
        if (input.storeNotice !== undefined)
            patch.storeNotice = String((_b = input.storeNotice) !== null && _b !== void 0 ? _b : '').trim() || null;
        if (input.storePhone !== undefined)
            patch.storePhone = String((_c = input.storePhone) !== null && _c !== void 0 ? _c : '').trim() || null;
        if (Object.keys(patch).length)
            await this.config.updateConfig(ctx, patch);
        return this.storeProfile(ctx);
    }
    /** 营业日历（§70）：整体替换休业日期列表（传空数组=关闭休业日历），返回最新门店资料 */
    async updateClosureDates(ctx, dates) {
        const list = (dates !== null && dates !== void 0 ? dates : []).map(d => { var _a, _b; return ({ date: String((_a = d === null || d === void 0 ? void 0 : d.date) !== null && _a !== void 0 ? _a : '').trim(), note: String((_b = d === null || d === void 0 ? void 0 : d.note) !== null && _b !== void 0 ? _b : '').trim() }); });
        await this.config.updateConfig(ctx, { closureDates: list });
        return this.storeProfile(ctx);
    }
    /** 商家自助经营数据：今日/近 7 日（含今日）单量、营业额、客单价、取消退款；另附近 30 日逐日明细供导出 */
    async revenue(ctx) {
        var _a;
        const now = Date.now();
        const today0 = (0, campus_time_1.startOfCampusDay)(now);
        const DAY_MS = 24 * 3600000;
        const DAYS = 30;
        const since = today0 - (DAYS - 1) * DAY_MS;
        const last7From = (0, campus_time_1.campusDayKey)(today0 - 6 * DAY_MS);
        const orders = await this.connection.getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            .andWhere('order.createdAt >= :since', { since: new Date(since) })
            .getMany();
        const dayMap = new Map();
        for (let i = DAYS - 1; i >= 0; i--) {
            const key = (0, campus_time_1.campusDayKey)(today0 - i * DAY_MS);
            dayMap.set(key, { date: key.slice(5), orders: 0, gross: 0, cancelled: 0, cancelledAmount: 0 });
        }
        const todayKey = (0, campus_time_1.campusDayKey)(now);
        const empty = () => ({ orders: 0, gross: 0, avgTicket: 0, cancelled: 0, cancelledAmount: 0 });
        const today = empty();
        const last7 = empty();
        for (const o of orders) {
            const cf = o.customFields;
            const total = (_a = o.totalWithTax) !== null && _a !== void 0 ? _a : 0;
            if (o.state === 'Cancelled') {
                const key = (0, campus_time_1.campusDayKey)(new Date(o.createdAt).getTime());
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
            if (cf.deliveryStatus !== 'delivered' || !cf.deliveredAt)
                continue;
            // 营业额按送达时间归日：跨零点订单计入实际送达当天
            const key = (0, campus_time_1.campusDayKey)(new Date(cf.deliveredAt).getTime());
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
    async customerContact(ctx, orderId) {
        var _a, _b;
        const order = await this.connection.getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.id = :id', { id: orderId })
            .andWhere('channel.id = :ch', { ch: ctx.channelId })
            .getOne();
        if (!order)
            throw new core_1.UserInputError('订单不存在或不属于当前店铺');
        return this.privacy.resolve(ctx, {
            channelId: ctx.channelId,
            orderCode: order.code,
            phone: (_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.phoneNumber) !== null && _b !== void 0 ? _b : null,
        });
    }
    /** 本渠道营业时间（Channel.customFields.waimaiBusinessHours）；原生查询，供工作台高频轮询 */
    async channelBusinessHours(ctx) {
        var _a;
        const rows = await this.connection.rawConnection.query('SELECT "customFieldsWaimaibusinesshours" AS hours FROM channel WHERE id = $1', [ctx.channelId]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const hours = (_a = list === null || list === void 0 ? void 0 : list[0]) === null || _a === void 0 ? void 0 : _a.hours;
        return hours == null || hours === '' ? null : String(hours);
    }
    async board(ctx) {
        var _a, _b, _c, _d, _e;
        const cfg = await this.config.getConfig(ctx);
        const repo = this.connection.getRepository(ctx, core_1.Order);
        const orders = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            // 仅拉活跃流转单：排除 delivered / cancelled / exception_final / no_rider_final 等终态，避免历史单无限增长
            .andWhere("order.customFields.hallStatus IN ('pending_merchant','accepted','open','grabbed','pending_dispatch','third_party','owned_pool','owned_dispatched','merchant_delivering','scheduled')")
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            // 顾客关联：工作台卡片展示脱敏手机号（便于按尾号检索/联系），不取明文
            .leftJoinAndSelect('order.customer', 'customer')
            .getMany();
        // 今日已送达口径：按校园时区（UTC+8）日界，不随部署服务器时区漂移
        const startOfDay = new Date((0, campus_time_1.startOfCampusDay)(Date.now()));
        const deliveredToday = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere("order.customFields.deliveryStatus = 'delivered'")
            .andWhere('order.customFields.deliveredAt >= :start', { start: startOfDay })
            .getMany();
        const active = orders.filter(o => {
            const cf = o.customFields;
            // 送达终态不再进流转栏（兼容历史脏数据：hallStatus 仍为 grabbed 但已送达）
            if (cf.deliveryStatus === 'delivered')
                return false;
            return [
                'pending_merchant', 'accepted', 'open', 'grabbed',
                'pending_dispatch', 'third_party', 'owned_pool', 'owned_dispatched', 'merchant_delivering',
            ].includes(cf.hallStatus);
        });
        // 预约单（scheduled）：按预约锚点升序，供商家提前备料知悉（不进入四栏流转）
        const scheduledOrders = orders
            .filter(o => o.customFields.hallStatus === 'scheduled')
            .sort((a, b) => {
            var _a, _b;
            const ta = new Date((_a = a.customFields.scheduledFor) !== null && _a !== void 0 ? _a : 0).getTime();
            const tb = new Date((_b = b.customFields.scheduledFor) !== null && _b !== void 0 ? _b : 0).getTime();
            return ta - tb;
        });
        const dtos = await this.toDto(ctx, active);
        const scheduledDtos = await this.toDto(ctx, scheduledOrders);
        const cfOf = (o) => o.customFields;
        const pending = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'pending_merchant');
        const cooking = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'accepted');
        const awaitingRider = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'open');
        const delivering = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'grabbed');
        const pick = (s) => dtos.filter((_, i) => cfOf(active[i]).hallStatus === s);
        const completedTodayAmount = deliveredToday.reduce((s, o) => s + (o.total || 0), 0);
        const printProvider = String((_a = cfg.printProvider) !== null && _a !== void 0 ? _a : 'local');
        // 营业时间（自动开关门）：轻量原生查询，避免工作台 10s 轮询时反复实例化 Channel 实体
        const hours = await this.channelBusinessHours(ctx);
        const closure = (0, closure_calendar_1.closedToday)((0, closure_calendar_1.safeClosureDates)(cfg.closureDates));
        return {
            paused: cfg.paused,
            openNow: (0, business_hours_1.isWithinBusinessHours)(hours) && !cfg.paused && !closure,
            businessHours: hours,
            nextTransition: (0, business_hours_1.nextBusinessTransition)(hours),
            merchantConfirmEnabled: cfg.merchantConfirmEnabled,
            printMode: (0, waimai_store_service_1.normalizePrintMode)(cfg.printMode),
            printProvider,
            cloudPrintConfigured: printProvider !== 'local' && !!cfg.printAccount && !!cfg.printDeviceSn && !!cfg.printDeviceKey,
            storeName: (_c = (_b = ctx.channel) === null || _b === void 0 ? void 0 : _b.code) !== null && _c !== void 0 ? _c : '',
            storePhone: (_d = cfg.storePhone) !== null && _d !== void 0 ? _d : null,
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
            closureNote: (_e = closure === null || closure === void 0 ? void 0 : closure.note) !== null && _e !== void 0 ? _e : null,
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
    async completedOrders(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g;
        const now = Date.now();
        const start = new Date(input.from ? String(input.from) : (0, campus_time_1.startOfCampusDay)(now));
        const end = new Date(input.to ? String(input.to) : now);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new core_1.UserInputError('时间区间格式不合法');
        }
        if (start.getTime() >= end.getTime())
            throw new core_1.UserInputError('结束时间必须晚于开始时间');
        // 明细按区间累计，防止误传超长区间把工作台拖慢（92 天足够覆盖季度对账前查看）
        if (end.getTime() - start.getTime() > 92 * 24 * 3600000) {
            throw new core_1.UserInputError('查询区间不能超过 92 天');
        }
        const take = Math.min(Math.max(Number((_a = input.take) !== null && _a !== void 0 ? _a : 100) || 100, 1), 300);
        const skip = Math.max(Number((_b = input.skip) !== null && _b !== void 0 ? _b : 0) || 0, 0);
        const repo = this.connection.getRepository(ctx, core_1.Order);
        const base = () => repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere("order.customFields.deliveryStatus = 'delivered'")
            .andWhere('order.customFields.deliveredAt >= :start', { start })
            .andWhere('order.customFields.deliveredAt < :end', { end });
        // 汇总：单量 + 总额（全区间，不被分页截断）
        // 注意：Order.total / totalWithTax 都是实体 getter（无对应数据库列），聚合须落到真实列 subTotalWithTax + shippingWithTax
        const sums = await base()
            .select('COALESCE(SUM(COALESCE("order"."subTotalWithTax", 0) + COALESCE("order"."shippingWithTax", 0)), 0)', 'amount')
            .addSelect('COUNT("order"."id")', 'count')
            .getRawOne();
        const total = Number((_c = sums === null || sums === void 0 ? void 0 : sums.count) !== null && _c !== void 0 ? _c : 0);
        const totalAmount = Number((_d = sums === null || sums === void 0 ? void 0 : sums.amount) !== null && _d !== void 0 ? _d : 0);
        const orders = await base()
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .leftJoinAndSelect('order.customer', 'customer')
            .orderBy('order.customFields.deliveredAt', 'DESC', 'NULLS LAST')
            .skip(skip)
            .take(take)
            .getMany();
        // 退款金额：按订单聚合（payment 关联订单，Failed 退款不计入）
        const refunds = new Map();
        // 已支付金额（§76 可退余额口径）：只认 Settled/Authorized，与 refundablePayments 一致
        const paids = new Map();
        if (orders.length) {
            const ids = orders.map(o => Number(o.id));
            const rows = await this.connection.rawConnection.query(`SELECT p."orderId" AS "orderId", COALESCE(SUM(r.total), 0) AS "amount"
                   FROM refund r
                   JOIN payment p ON p.id = r."paymentId"
                  WHERE p."orderId" IN (${ids.map((_, i) => '$' + (i + 1)).join(',')})
                    AND r.state <> 'Failed'
                  GROUP BY p."orderId"`, ids);
            for (const row of rows !== null && rows !== void 0 ? rows : [])
                refunds.set(String(row.orderId), Number((_e = row.amount) !== null && _e !== void 0 ? _e : 0));
            const paidRows = await this.connection.rawConnection.query(`SELECT p."orderId" AS "orderId", COALESCE(SUM(p.amount), 0) AS "amount"
                   FROM payment p
                  WHERE p."orderId" IN (${ids.map((_, i) => '$' + (i + 1)).join(',')})
                    AND p.state IN ('Settled', 'Authorized')
                  GROUP BY p."orderId"`, ids);
            for (const row of paidRows !== null && paidRows !== void 0 ? paidRows : [])
                paids.set(String(row.orderId), Number((_f = row.amount) !== null && _f !== void 0 ? _f : 0));
        }
        const buildingIds = new Set();
        const riderIds = new Set();
        for (const o of orders) {
            const cf = o.customFields;
            if (cf.buildingId)
                buildingIds.add(String(cf.buildingId));
            if (cf.deliveryStaffId)
                riderIds.add(Number(cf.deliveryStaffId));
        }
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, campus_building_entity_1.CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        const riders = riderIds.size
            ? await this.connection.rawConnection.getRepository('Customer').findByIds([...riderIds])
            : [];
        const riderNames = new Map(riders.map(c => { var _a, _b; return [String(c.id), (_b = (_a = c.customFields) === null || _a === void 0 ? void 0 : _a.riderRealName) !== null && _b !== void 0 ? _b : '']; }));
        const items = orders.map(o => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const cf = o.customFields;
            const refundAmount = (_a = refunds.get(String(o.id))) !== null && _a !== void 0 ? _a : 0;
            // 可退余额 = 已支付 − 已退（§76）：未支付 / 已全额退款为 0，前端据此隐藏退款入口
            const refundable = Math.max(((_b = paids.get(String(o.id))) !== null && _b !== void 0 ? _b : 0) - refundAmount, 0);
            const lineText = ((_c = o.lines) !== null && _c !== void 0 ? _c : [])
                .map(l => { var _a, _b; return `${(_b = (_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : ''}×${l.quantity}`; })
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
                building: cf.buildingId ? (_d = buildingNames.get(String(cf.buildingId))) !== null && _d !== void 0 ? _d : '' : '',
                zone: (_e = cf.campusZone) !== null && _e !== void 0 ? _e : '',
                route: (_f = cf.fulfillmentRoute) !== null && _f !== void 0 ? _f : '',
                riderName: cf.deliveryStaffId ? (_g = riderNames.get(String(cf.deliveryStaffId))) !== null && _g !== void 0 ? _g : null : null,
                customerPhone: this.privacy.mask((_j = (_h = o.customer) === null || _h === void 0 ? void 0 : _h.phoneNumber) !== null && _j !== void 0 ? _j : null),
                lineText,
                note: (_k = cf.note) !== null && _k !== void 0 ? _k : null,
            };
        });
        // 区间退款总额：按订单聚合退款单（Failed 不计），不受分页影响
        const refundSum = await base()
            .leftJoin('order.payments', 'payment')
            .leftJoin('payment.refunds', 'refund')
            .select('COALESCE(SUM(refund.total), 0)', 'amount')
            .andWhere("refund.state <> 'Failed'")
            .getRawOne();
        const refundAmount = Number((_g = refundSum === null || refundSum === void 0 ? void 0 : refundSum.amount) !== null && _g !== void 0 ? _g : 0);
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
    async refunds(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const now = Date.now();
        const start = new Date(input.from ? String(input.from) : (0, campus_time_1.startOfCampusDay)(now));
        const end = new Date(input.to ? String(input.to) : now);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new core_1.UserInputError('时间区间格式不合法');
        }
        if (start.getTime() >= end.getTime())
            throw new core_1.UserInputError('结束时间必须晚于开始时间');
        if (end.getTime() - start.getTime() > 92 * 24 * 3600000) {
            throw new core_1.UserInputError('查询区间不能超过 92 天');
        }
        const take = Math.min(Math.max(Number((_a = input.take) !== null && _a !== void 0 ? _a : 100) || 100, 1), 300);
        const skip = Math.max(Number((_b = input.skip) !== null && _b !== void 0 ? _b : 0) || 0, 0);
        const raw = this.connection.rawConnection;
        const chId = Number(ctx.channelId);
        // 店铺隔离：退款单经支付单回落到订单，再用订单-渠道关联表判定归属（EXISTS 避免重复行）
        // 关联表名由 TypeORM 惯用命名生成：order_channels_channel
        const scope = `r."createdAt" >= $1 AND r."createdAt" < $2
              AND EXISTS (SELECT 1 FROM order_channels_channel oc WHERE oc."orderId" = o.id AND oc."channelId" = $3)`;
        const rows = await raw.query(`SELECT r.id AS "id", r.total AS "amount", r.state AS "state", r.reason AS "reason",
                    r."createdAt" AS "createdAt", p."orderId" AS "orderId", o.code AS "code"
               FROM refund r
               JOIN payment p ON p.id = r."paymentId"
               JOIN "order" o ON o.id = p."orderId"
              WHERE ${scope}
              ORDER BY r."createdAt" DESC
              LIMIT $4 OFFSET $5`, [start, end, chId, take, skip]);
        // 汇总：区分成功/失败笔数与金额（全区间，不受分页影响）
        const agg = await raw.query(`SELECT COUNT(*) FILTER (WHERE r.state <> 'Failed') AS "count",
                    COALESCE(SUM(r.total) FILTER (WHERE r.state <> 'Failed'), 0) AS "amount",
                    COUNT(*) FILTER (WHERE r.state = 'Failed') AS "failedCount",
                    COALESCE(SUM(r.total) FILTER (WHERE r.state = 'Failed'), 0) AS "failedAmount",
                    COUNT(*) AS "total"
               FROM refund r
               JOIN payment p ON p.id = r."paymentId"
               JOIN "order" o ON o.id = p."orderId"
              WHERE ${scope}`, [start, end, chId]);
        const sum = (_c = agg === null || agg === void 0 ? void 0 : agg[0]) !== null && _c !== void 0 ? _c : {};
        // 楼栋/区域：自定义字段只在订单实体上，按订单 id 回查（避免猜原生列名）
        const orderIds = [...new Set(rows.map(r => String(r.orderId)))];
        const orders = orderIds.length
            ? await this.connection.getRepository(ctx, core_1.Order).findByIds(orderIds)
            : [];
        const orderMap = new Map(orders.map(o => [String(o.id), o.customFields]));
        const buildingIds = new Set();
        for (const cf of orderMap.values())
            if (cf === null || cf === void 0 ? void 0 : cf.buildingId)
                buildingIds.add(String(cf.buildingId));
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, campus_building_entity_1.CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        // 商家退款原因写入了「merchant refund (单号): 原因」留痕前缀，展示时剥掉
        const MERCHANT_PREFIX = /^merchant refund \([^)]*\):\s*/;
        const items = rows.map(r => {
            var _a, _b, _c, _d, _e, _f;
            const rawReason = String((_a = r.reason) !== null && _a !== void 0 ? _a : '');
            const cf = orderMap.get(String(r.orderId));
            return {
                id: String(r.id),
                orderId: String(r.orderId),
                code: String((_b = r.code) !== null && _b !== void 0 ? _b : ''),
                amount: Number((_c = r.amount) !== null && _c !== void 0 ? _c : 0),
                state: String((_d = r.state) !== null && _d !== void 0 ? _d : ''),
                reason: rawReason.replace(MERCHANT_PREFIX, ''),
                source: MERCHANT_PREFIX.test(rawReason) ? 'merchant' : 'platform',
                createdAt: new Date(r.createdAt),
                building: (cf === null || cf === void 0 ? void 0 : cf.buildingId) ? (_e = buildingNames.get(String(cf.buildingId))) !== null && _e !== void 0 ? _e : '' : '',
                zone: (_f = cf === null || cf === void 0 ? void 0 : cf.campusZone) !== null && _f !== void 0 ? _f : '',
            };
        });
        return {
            items,
            count: Number((_d = sum.count) !== null && _d !== void 0 ? _d : 0),
            amount: Number((_e = sum.amount) !== null && _e !== void 0 ? _e : 0),
            failedCount: Number((_f = sum.failedCount) !== null && _f !== void 0 ? _f : 0),
            failedAmount: Number((_g = sum.failedAmount) !== null && _g !== void 0 ? _g : 0),
            total: Number((_h = sum.total) !== null && _h !== void 0 ? _h : 0),
            start,
            end,
        };
    }
    /** 商家接单确认：pending_merchant → accepted */
    async acceptOrder(ctx, orderId) {
        const order = await this.assertChannelOrder(ctx, orderId, 'pending_merchant');
        const moved = await this.transitionToAccepted(ctx, order.id, 'manual');
        if (!moved)
            throw new core_1.UserInputError('订单状态已变更，请刷新');
        return { ok: true };
    }
    /** 接单内核（手动/自动共用）：条件写防并发 + 用户通知 + 接单即出票；返回是否真正迁移成功 */
    async transitionToAccepted(ctx, orderId, trigger) {
        var _a;
        const patch = { hallStatus: 'accepted' };
        // 自动接单留痕：既做每日上限统计，也方便客服区分人工/自动接单
        if (trigger === 'auto')
            patch.autoAcceptedAt = new Date();
        // 条件写：与用户取消/调度商家超时兜底并发时，已脱厅单不得被改回 accepted
        const moved = await this.hall.transitionFrom(ctx, Number(orderId), ['pending_merchant'], patch);
        if (!moved)
            return false;
        this.notify.user(ctx, orderId, 'orderAccepted');
        // 云打印（P1-4）：接单即出票（printMode=onAccepted 且走云通道）；失败只留任务记录，不阻塞接单
        const cfg = await this.config.getConfig(ctx);
        if ((0, waimai_store_service_1.normalizePrintMode)(cfg.printMode) === 'onAccepted' && String((_a = cfg.printProvider) !== null && _a !== void 0 ? _a : 'local') !== 'local') {
            void this.cloud.printOrder(ctx, orderId, 'auto').catch(() => undefined);
        }
        return true;
    }
    /** 商家拒单/商品缺货：接单前（pending_merchant）或备餐中（accepted）可拒，
     * 全额退款 + 取消订单（取消后由 Cancelled 转换自动脱厅/释放时段锁位）。
     * 退款幂等口径与 T4/异常处置一致：先查已退总额，仅退剩余部分。 */
    async rejectOrder(ctx, orderId, reason) {
        var _a, _b, _c, _d;
        const trimmed = (reason !== null && reason !== void 0 ? reason : '').trim();
        if (!trimmed)
            throw new core_1.UserInputError('请填写拒单原因');
        if (trimmed.length > 200)
            throw new core_1.UserInputError('拒单原因不能超过 200 个字符');
        const order = await this.assertChannelOrderState(ctx, orderId, ['pending_merchant', 'accepted']);
        // 并发防重退款：拒单是「查已退总额 → 退差额 → 取消」的复合动作，
        // 与 T4/运营处置并发时无锁会双退。用 PG 会话级咨询锁按订单串行化（同连接 runner 持有/释放）。
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:refund:${order.id}`;
        try {
            const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.ok))
                throw new core_1.UserInputError('该订单正在退款处理中，请稍后重试');
            // 锁内复查：等待锁期间订单可能已被 T4/调度超时兜底改派或用户取消，
            // 此时再退款+取消会把已流转的单重复退款
            const fresh = await this.connection.getRepository(ctx, core_1.Order).findOne({
                where: { id: order.id },
            });
            const freshHs = String((_c = (_b = fresh === null || fresh === void 0 ? void 0 : fresh.customFields) === null || _b === void 0 ? void 0 : _b.hallStatus) !== null && _c !== void 0 ? _c : '');
            if (!['pending_merchant', 'accepted'].includes(freshHs)) {
                throw new core_1.UserInputError('订单状态已变更，请刷新');
            }
            // 只退成功支付且仍有余额的支付单（避免选中 Declined/Error 重试单导致退款失败）
            for (const picked of await (0, refund_payment_1.refundablePayments)(this.connection, Number(order.id))) {
                const rest = picked.remaining;
                if (rest > 0) {
                    const created = await this.orderService.refundOrder(ctx, {
                        paymentId: picked.payment.id,
                        amount: rest,
                        // refund 表 shipping/adjustment 列 NOT NULL，显式给 0（同 T4）
                        shipping: 0,
                        adjustment: 0,
                        reason: `merchant reject (${order.code})`,
                    });
                    if (!created || created.errorCode) {
                        throw new core_1.UserInputError(`退款失败：${(_d = created === null || created === void 0 ? void 0 : created.errorCode) !== null && _d !== void 0 ? _d : '未知原因'}`);
                    }
                    await (0, refund_payment_1.settleRefundOrMarkFailed)(this.connection, this.orderService, ctx, created.id);
                }
            }
            // 先留痕再取消：脱厅只写 hallStatus，不覆盖 campusCause
            await this.hall.updateOrder(ctx, order.id, {
                customFields: { campusCause: 'merchant_rejected' },
            });
            const cancelled = await this.orderService.cancelOrder(ctx, {
                orderId: order.id,
                reason: `商家拒单：${trimmed}`,
            });
            if (cancelled && cancelled.errorCode) {
                throw new Error(`cancelOrder failed: ${cancelled.errorCode}`);
            }
            this.notify.user(ctx, order.id, 'orderCancelled', trimmed);
            return { ok: true };
        }
        finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            }
            catch (_e) {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }
    /** 商家发起退款（§76）：已送达订单可整单/部分退款，复用既有 refund 通道。
     * 与拒单/运营异常处置共用订单级咨询锁，避免并发双退。 */
    async merchantRefund(ctx, orderId, amount, reason) {
        var _a, _b, _c, _d, _e, _f;
        const trimmed = (reason !== null && reason !== void 0 ? reason : '').trim();
        if (!trimmed)
            throw new core_1.UserInputError('请填写退款原因');
        if (trimmed.length > 200)
            throw new core_1.UserInputError('退款原因不能超过 200 个字符');
        const fen = Math.floor(Number(amount));
        if (!Number.isFinite(fen) || fen <= 0)
            throw new core_1.UserInputError('退款金额必须大于 0');
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['channels'],
        });
        const inChannel = (_a = order === null || order === void 0 ? void 0 : order.channels) === null || _a === void 0 ? void 0 : _a.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel)
            throw new core_1.UserInputError('订单不存在或不属于当前店铺');
        // 只对已送达单开放：在途单请走「拒单」（备餐中）或联系运营异常处置，避免配送与退款错位
        if (String((_b = order.customFields.deliveryStatus) !== null && _b !== void 0 ? _b : '') !== 'delivered') {
            throw new core_1.UserInputError('仅已送达订单可发起退款');
        }
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:refund:${order.id}`;
        try {
            const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!((_c = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _c === void 0 ? void 0 : _c.ok))
                throw new core_1.UserInputError('该订单正在退款处理中，请稍后重试');
            // 锁内重新统计余额（与运营处置/拒单并发时以最新余额为准）
            const payments = await (0, refund_payment_1.refundablePayments)(this.connection, Number(order.id));
            const remaining = payments.reduce((s, p) => s + p.remaining, 0);
            if (remaining <= 0)
                throw new core_1.UserInputError('该订单已无可退余额');
            if (fen > remaining) {
                throw new core_1.UserInputError(`退款金额超过可退余额（最多可退 ¥${(remaining / 100).toFixed(2)}）`);
            }
            // 新→旧逐张退，凑够本次金额（多支付单订单按各张余额分摊）
            let rest = fen;
            for (const picked of payments) {
                if (rest <= 0)
                    break;
                const part = Math.min(rest, picked.remaining);
                const created = await this.orderService.refundOrder(ctx, {
                    paymentId: picked.payment.id,
                    amount: part,
                    // refund 表 shipping/adjustment 列 NOT NULL，显式给 0（同 T4/拒单）
                    shipping: 0,
                    adjustment: 0,
                    reason: `merchant refund (${order.code}): ${trimmed}`,
                });
                if (!created || created.errorCode) {
                    throw new core_1.UserInputError(`退款失败：${(_d = created === null || created === void 0 ? void 0 : created.errorCode) !== null && _d !== void 0 ? _d : '未知原因'}`);
                }
                await (0, refund_payment_1.settleRefundOrMarkFailed)(this.connection, this.orderService, ctx, created.id);
                rest -= part;
            }
            // 售后触达顾客（未配置模板/短信网关时静默跳过）
            this.notify.user(ctx, order.id, 'afterSales', `商家退款 ¥${(fen / 100).toFixed(2)} 已原路退回`);
            // 回执口径与对账页一致：累计已退排除 Failed（结算失败单不改变实际余额）
            const refundedRows = await this.connection.rawConnection.query(`SELECT COALESCE(SUM(r.total), 0) AS "amount"
                   FROM refund r
                   JOIN payment p ON p.id = r."paymentId"
                  WHERE p."orderId" = $1 AND r.state <> 'Failed'`, [Number(order.id)]);
            const refundedTotal = Number((_f = (_e = refundedRows === null || refundedRows === void 0 ? void 0 : refundedRows[0]) === null || _e === void 0 ? void 0 : _e.amount) !== null && _f !== void 0 ? _f : 0);
            const after = await (0, refund_payment_1.refundablePayments)(this.connection, Number(order.id));
            const refundable = after.reduce((s, p) => s + p.remaining, 0);
            return { ok: true, amount: fen, refundedTotal, refundable };
        }
        finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            }
            catch (_g) {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }
    /** 出餐完成：按路线/承运分流（不再统一入抢单大厅） */
    async cookingDone(ctx, orderId) {
        var _a, _b;
        const order = await this.assertChannelOrder(ctx, orderId, 'accepted');
        const cf = order.customFields;
        const route = String((_a = cf.fulfillmentRoute) !== null && _a !== void 0 ? _a : '');
        const plan = String((_b = cf.deliveryPlan) !== null && _b !== void 0 ? _b : '');
        let patch;
        // R1：第一段由商户或自营快递完成，之后才进校园接力大厅
        if (route === 'R1') {
            patch = plan === 'owned'
                // 自营快递接单后送往交接点（cookingDone 即表示可以出发）
                ? { hallStatus: 'owned_dispatched', assignedAt: new Date() }
                : { hallStatus: 'merchant_delivering', assignedAt: new Date() };
        }
        else if (plan === 'external_courier') {
            // R2 与 R3-外部：等运营中心推送外部快递（assignedAt 标记出餐时刻，未推送超时从此计时）
            patch = { hallStatus: 'pending_dispatch', assignedAt: new Date() };
        }
        else if (plan === 'owned') {
            // R3-自营：进自营快递池抢单
            patch = { hallStatus: 'owned_pool' };
        }
        else {
            // R3-传信者：正常入抢单大厅
            patch = { hallStatus: 'open', hallEnteredAt: new Date() };
        }
        // 条件写：与用户取消/调度超时兜底并发时，已脱厅单不得被改回流转态
        const moved = await this.hall.transitionFrom(ctx, Number(order.id), ['accepted'], patch);
        if (!moved)
            throw new core_1.UserInputError('订单状态已变更，请刷新');
        this.notify.user(ctx, order.id, 'cookingDone');
        return { ok: true };
    }
    /** 批量接单（§73）：逐单复用单笔接单（含通知/云打印），失败跳过并回报 */
    async batchAcceptOrders(ctx, orderIds) {
        return this.runBatch(orderIds, id => this.acceptOrder(ctx, id));
    }
    /** 批量出餐（§73）：逐单复用单笔出餐分流，失败跳过并回报 */
    async batchCookingDone(ctx, orderIds) {
        return this.runBatch(orderIds, id => this.cookingDone(ctx, id));
    }
    /** 顺序执行批量动作：单笔失败（状态已变更/已脱厅/退款中等）只记明细，不中断后续单 */
    async runBatch(orderIds, run) {
        var _a;
        let ids;
        try {
            ids = (0, batch_orders_1.normalizeBatchOrderIds)(orderIds);
        }
        catch (err) {
            // 入参问题（空集合 / 超上限）属于调用方错误，直接以 UserInputError 反馈
            throw err instanceof batch_orders_1.BatchOrderInputError ? new core_1.UserInputError(err.message) : err;
        }
        let ok = 0;
        const failed = [];
        for (const id of ids) {
            try {
                await run(id);
                ok++;
            }
            catch (err) {
                failed.push({ orderId: id, message: (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : '操作失败' });
            }
        }
        return { ok, failed };
    }
    /** 运营中心推送外部快递（选 dada / meituan） */
    async dispatchExternal(ctx, orderId, provider) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.dispatchExternal(ctx, orderId, provider);
    }
    /** 取消外部快递（改推另一家 / 回落大厅前） */
    async cancelExternal(ctx, orderId, reason) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.cancel(ctx, orderId, reason);
    }
    /** 自营快递接单（R1 商户超时转自营 / R3 自营池） */
    async acceptOwned(ctx, orderId) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.acceptOwned(ctx, orderId);
    }
    /** R1：商户把餐送到校园交接点 → 传信者接力 */
    async markHandoverArrived(ctx, orderId) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.completeFirstLeg(ctx, orderId, 'merchant_handover');
    }
    /** 自营快递送达（R1/R2 到交接点，R3 到学生） */
    async markOwnedArrived(ctx, orderId) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.completeFirstLeg(ctx, orderId, 'owned_handover');
    }
    /** 营业开关：商家仅可切换本渠道 paused，其余配置仍归 CampusConfig 管理员 */
    async setPaused(ctx, paused) {
        await this.config.updateConfig(ctx, { paused });
        return { ok: true };
    }
    /** 自动接单设置（§69）：含今日已自动接单数与当前营业条件（休息中自动失效） */
    async autoAcceptSettings(ctx) {
        var _a, _b;
        const cfg = await this.config.getConfig(ctx);
        const hours = await this.channelBusinessHours(ctx);
        return {
            enabled: !!cfg.autoAcceptEnabled,
            delaySeconds: Number((_a = cfg.autoAcceptDelaySeconds) !== null && _a !== void 0 ? _a : auto_accept_1.AUTO_ACCEPT_DEFAULT_DELAY_SECONDS),
            dailyLimit: Number((_b = cfg.autoAcceptDailyLimit) !== null && _b !== void 0 ? _b : 0),
            routes: (0, auto_accept_1.normalizeAutoAcceptRoutes)(cfg.autoAcceptRoutes),
            acceptedToday: await this.countAutoAcceptedToday(ctx.channelId),
            // 与手动接单/C 端营业态同口径：营业时段内、未临时休息、且今日不在休业日历才会自动接
            openNow: (0, business_hours_1.isWithinBusinessHours)(hours) && !cfg.paused && !(0, closure_calendar_1.closedToday)((0, closure_calendar_1.safeClosureDates)(cfg.closureDates)),
            merchantConfirmEnabled: !!cfg.merchantConfirmEnabled,
        };
    }
    /** 自动接单设置保存：延迟/上限/路线走配置白名单校验（越界直接报错，不静默截断） */
    async updateAutoAccept(ctx, input) {
        const patch = { autoAcceptEnabled: !!input.enabled };
        if (input.delaySeconds !== undefined && input.delaySeconds !== null) {
            patch.autoAcceptDelaySeconds = Number(input.delaySeconds);
        }
        if (input.dailyLimit !== undefined && input.dailyLimit !== null) {
            patch.autoAcceptDailyLimit = Number(input.dailyLimit);
        }
        if (input.routes !== undefined && input.routes !== null) {
            patch.autoAcceptRoutes = (0, auto_accept_1.normalizeAutoAcceptRoutes)(input.routes);
        }
        await this.config.updateConfig(ctx, patch);
        return this.autoAcceptSettings(ctx);
    }
    /** 本店本校园日自动接单数（按 autoAcceptedAt 统计，跨零点自动归零） */
    async countAutoAcceptedToday(channelId) {
        var _a, _b;
        const rows = await this.connection.rawConnection.query('SELECT COUNT(*)::int AS n FROM "order" o '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id AND oc."channelId" = $1 '
            + 'WHERE o."customFieldsAutoacceptedat" >= $2', [channelId, new Date((0, campus_time_1.startOfCampusDay)(Date.now()))]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        return Number(Array.isArray(list) ? (_b = (_a = list[0]) === null || _a === void 0 ? void 0 : _a.n) !== null && _b !== void 0 ? _b : 0 : 0) || 0;
    }
    /** 小票打印回执：工作台打印成功后回写 waimaiPrintedAt（防重打 + 补打依据），不限订单状态 */
    async markPrinted(ctx, orderId) {
        var _a;
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['channels'],
        });
        const inChannel = (_a = order === null || order === void 0 ? void 0 : order.channels) === null || _a === void 0 ? void 0 : _a.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel)
            throw new core_1.UserInputError('订单不存在或不属于当前店铺');
        await this.hall.updateOrder(ctx, order.id, {
            customFields: { waimaiPrintedAt: new Date() },
        });
        return { ok: true };
    }
    /** 商家确认「已知晓」顾客催单（§78）：只落小表时间戳，不改顾客侧 urged/urgedAt（骑手端仍可见催单标记） */
    async ackUrge(ctx, orderId) {
        var _a, _b;
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['channels'],
        });
        const inChannel = (_a = order === null || order === void 0 ? void 0 : order.channels) === null || _a === void 0 ? void 0 : _a.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel)
            throw new core_1.UserInputError('订单不存在或不属于当前店铺');
        const cf = ((_b = order.customFields) !== null && _b !== void 0 ? _b : {});
        if (cf.urged !== true || !cf.urgedAt)
            throw new core_1.UserInputError('该订单没有待处理的顾客催单');
        await this.connection.rawConnection.query('INSERT INTO campus_urge_ack ("channelId", "orderId", "ackedAt") VALUES ($1, $2, now()) '
            + 'ON CONFLICT ("channelId", "orderId") DO UPDATE SET "ackedAt" = now(), "updatedAt" = now()', [ctx.channelId, Number(order.id)]);
        return { ok: true };
    }
    /** 批量取催单「已知晓」时间（§78）；小表缺失时按未处理兜底，不阻断工作台 */
    async urgeAckMap(ctx, orderIds) {
        const ids = orderIds.filter(n => Number.isFinite(n));
        if (!ids.length)
            return new Map();
        try {
            const rows = await this.connection.rawConnection.query('SELECT "orderId", "ackedAt" FROM campus_urge_ack WHERE "channelId" = $1 AND "orderId" = ANY($2::int[])', [ctx.channelId, ids]);
            const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
            return new Map((Array.isArray(list) ? list : []).map((r) => [
                String(r.orderId),
                new Date(r.ackedAt),
            ]));
        }
        catch (_a) {
            return new Map();
        }
    }
    /** 云打印一张小票（后端签名直连服务商）：成功即回写 printedAt */
    async cloudPrint(ctx, orderId) {
        return this.cloud.printOrder(ctx, orderId, 'manual');
    }
    /** 云打印连通性测试（不占用订单） */
    async cloudPrintTest(ctx) {
        return this.cloud.testPrint(ctx);
    }
    /** 最近云打印任务（排障） */
    async printJobs(ctx, limit) {
        return this.cloud.recentJobs(ctx, limit);
    }
    /** KDS 出餐屏队列：待接单 + 备餐中（按支付先后出票，超时标红） */
    async kitchenQueue(ctx) {
        const orders = await this.connection.getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere("order.customFields.hallStatus IN ('pending_merchant','accepted')")
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .orderBy('order.createdAt', 'ASC')
            .getMany();
        const buildingIds = new Set();
        for (const o of orders) {
            const id = o.customFields.buildingId;
            if (id)
                buildingIds.add(String(id));
        }
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, campus_building_entity_1.CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        const now = Date.now();
        const ackMap = await this.urgeAckMap(ctx, orders.map(o => Number(o.id)));
        const tickets = orders.map(o => {
            var _a, _b, _c, _d, _e, _f, _g;
            const cf = o.customFields;
            const urgedAt = cf.urgedAt ? new Date(cf.urgedAt) : null;
            const waitingMinutes = Math.max(0, Math.floor((now - new Date(o.createdAt).getTime()) / 60000));
            return {
                id: String(o.id),
                code: o.code,
                stage: cf.hallStatus === 'accepted' ? 'cooking' : 'pending',
                createdAt: o.createdAt,
                waitingMinutes,
                urgency: waitingMinutes >= exports.KDS_LATE_MINUTES ? 'late' : waitingMinutes >= exports.KDS_WARN_MINUTES ? 'warn' : 'normal',
                zone: (_a = cf.campusZone) !== null && _a !== void 0 ? _a : '',
                building: cf.buildingId ? (_b = buildingNames.get(String(cf.buildingId))) !== null && _b !== void 0 ? _b : '' : '',
                slotText: (_c = cf.deliverySlotText) !== null && _c !== void 0 ? _c : '',
                note: (_d = cf.note) !== null && _d !== void 0 ? _d : null,
                printedAt: (_e = cf.waimaiPrintedAt) !== null && _e !== void 0 ? _e : null,
                total: o.total,
                urged: isUrgePending(cf.urged, urgedAt, (_f = ackMap.get(String(o.id))) !== null && _f !== void 0 ? _f : null),
                lines: ((_g = o.lines) !== null && _g !== void 0 ? _g : []).map(l => {
                    var _a, _b, _c;
                    const addonsText = (0, addon_fee_1.addonDisplayText)((_a = l.customFields) === null || _a === void 0 ? void 0 : _a.waimaiAddons);
                    return {
                        name: (_c = (_b = l.productVariant) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : '',
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
            warnMinutes: exports.KDS_WARN_MINUTES,
            lateMinutes: exports.KDS_LATE_MINUTES,
        };
    }
    /** 一键沽清：商品列表（本渠道），带售罄标记与规格数（搜索按名称模糊） */
    async products(ctx, search, skip, take) {
        var _a, _b;
        const q = String(search !== null && search !== void 0 ? search : '').trim();
        const safeSkip = Math.max(0, Number(skip !== null && skip !== void 0 ? skip : 0) || 0);
        const safeTake = Math.min(Math.max(Number(take !== null && take !== void 0 ? take : 50) || 50, 1), 200);
        const rows = await this.connection.rawConnection.query('SELECT p.id AS "productId", COALESCE(pt.name, \'商品 #\' || p.id) AS name, '
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
            + 'ORDER BY p.id DESC LIMIT $3 OFFSET $4', [ctx.channelId, q, safeTake, safeSkip]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const countRows = await this.connection.rawConnection.query('SELECT COUNT(*)::int AS n FROM product p '
            + 'JOIN product_channels_channel pc ON pc."productId" = p.id AND pc."channelId" = $1 '
            + 'LEFT JOIN LATERAL (SELECT name FROM product_translation pt WHERE pt."baseId" = p.id '
            + 'ORDER BY (pt."languageCode" = \'zh_Hans\') DESC LIMIT 1) pt ON true '
            + 'WHERE ($2 = \'\' OR pt.name ILIKE \'%\' || $2 || \'%\')', [ctx.channelId, q]);
        const countList = Array.isArray(countRows) && Array.isArray(countRows[0]) ? countRows[0] : countRows;
        // 当日已售（§68）：仅商品列表这一页涉及的商品，限量商品才展示剩余
        const ids = (list !== null && list !== void 0 ? list : []).map((r) => Number(r.productId)).filter((n) => Number.isFinite(n));
        const soldMap = await (0, daily_limit_1.queryDailySold)(this.connection.rawConnection, Number(ctx.channelId), ids);
        return {
            items: (list !== null && list !== void 0 ? list : []).map((r) => {
                var _a, _b, _c, _d;
                return ({
                    productId: r.productId,
                    name: r.name,
                    soldOut: Boolean(r.soldOut),
                    monthlySales: Number((_a = r.monthlySales) !== null && _a !== void 0 ? _a : 0),
                    variantCount: Number((_b = r.variantCount) !== null && _b !== void 0 ? _b : 0),
                    packingFee: r.packingFee == null ? null : Number(r.packingFee),
                    // 加料组/套餐以 JSON 字符串回传，后台编辑 sheet 直接反序列化回填
                    addonGroups: r.addonGroups == null ? null : String(r.addonGroups),
                    combo: r.combo == null ? null : String(r.combo),
                    dailyLimit: (0, daily_limit_1.normalizeLimit)(r.dailyLimit),
                    perUserLimit: (0, daily_limit_1.normalizeLimit)(r.perUserLimit),
                    soldToday: (_c = soldMap.get(Number(r.productId))) !== null && _c !== void 0 ? _c : 0,
                    remaining: (0, daily_limit_1.remainingOf)((0, daily_limit_1.normalizeLimit)(r.dailyLimit), (_d = soldMap.get(Number(r.productId))) !== null && _d !== void 0 ? _d : 0),
                });
            }),
            total: Number((_b = (_a = countList === null || countList === void 0 ? void 0 : countList[0]) === null || _a === void 0 ? void 0 : _a.n) !== null && _b !== void 0 ? _b : 0),
        };
    }
    /** 沽清开关：售罄仍展示、不可加购；下单前置闸门二次校验 */
    async setProductSoldOut(ctx, productId, soldOut) {
        const inChannel = await this.connection.getRepository(ctx, core_1.Product).createQueryBuilder('product')
            .leftJoin('product.channels', 'channel')
            .where('product.id = :id', { id: productId })
            .andWhere('channel.id = :ch', { ch: ctx.channelId })
            .getOne();
        if (!inChannel)
            throw new core_1.UserInputError('商品不存在或不属于当前店铺');
        await this.connection.getRepository(ctx, core_1.Product).update(productId, {
            customFields: { waimaiSoldOut: Boolean(soldOut) },
        });
        // 手动开关即代表「非全店沽清批次」：清掉批次登记，次日自动恢复不再动它
        await this.clearSoldOutBatch(ctx, { productId: productId });
        return { ok: true, soldOut: Boolean(soldOut) };
    }
    /** 全店批量沽清 / 批量恢复：仅本渠道商品，返回实际影响条数（打烊后一键恢复用） */
    async setAllProductsSoldOut(ctx, soldOut) {
        const flag = Boolean(soldOut);
        const rows = await this.connection.rawConnection.query('UPDATE product p SET "customFieldsWaimaisoldout" = $2 '
            + 'FROM product_channels_channel pc '
            + 'WHERE pc."productId" = p.id AND pc."channelId" = $1 '
            + 'RETURNING p.id', [ctx.channelId, flag]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const ids = (Array.isArray(list) ? list : []).map((r) => Number(r.id));
        if (flag) {
            // 登记批次：仅供次日 04:00 自动恢复命中这些商品
            await this.connection.rawConnection.query('INSERT INTO campus_soldout_batch ("channelId", "productId") '
                + 'SELECT $1, unnest($2::int[]) '
                + 'ON CONFLICT ("channelId", "productId") DO NOTHING', [ctx.channelId, ids]);
        }
        else {
            await this.clearSoldOutBatch(ctx, {});
        }
        return { ok: true, soldOut: flag, count: ids.length };
    }
    /** 清除全店沽清批次登记（传 productId 只清该商品） */
    async clearSoldOutBatch(ctx, opts) {
        if (opts.productId != null) {
            await this.connection.rawConnection.query('DELETE FROM campus_soldout_batch WHERE "channelId" = $1 AND "productId" = $2', [ctx.channelId, opts.productId]);
            return;
        }
        await this.connection.rawConnection.query('DELETE FROM campus_soldout_batch WHERE "channelId" = $1', [ctx.channelId]);
    }
    /** 沽清自动恢复开关 + 待恢复件数（后台开关与文案用）；开关列由 §66 迁移补，不在 customFields 声明（避免 schema sync 并发加列失败） */
    async getSoldOutAutoRestore(ctx) {
        var _a;
        const rows = await this.connection.rawConnection.query('SELECT "customFieldsWaimaisoldoutautorestore" AS enabled FROM channel WHERE id = $1', [ctx.channelId]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const enabled = Array.isArray(list) && list.length ? ((_a = list[0]) === null || _a === void 0 ? void 0 : _a.enabled) !== false : true;
        const pending = await this.countSoldOutBatch(ctx.channelId);
        return { enabled, pending };
    }
    async setSoldOutAutoRestore(ctx, enabled) {
        await this.connection.rawConnection.query('UPDATE channel SET "customFieldsWaimaisoldoutautorestore" = $2 WHERE id = $1', [ctx.channelId, Boolean(enabled)]);
        const pending = await this.countSoldOutBatch(ctx.channelId);
        return { enabled: Boolean(enabled), pending };
    }
    async countSoldOutBatch(channelId) {
        var _a, _b;
        const rows = await this.connection.rawConnection.query('SELECT COUNT(*)::int AS n FROM campus_soldout_batch WHERE "channelId" = $1', [channelId]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        return Number(Array.isArray(list) ? (_b = (_a = list[0]) === null || _a === void 0 ? void 0 : _a.n) !== null && _b !== void 0 ? _b : 0 : 0) || 0;
    }
    /** 商品级打包费（分/件）：null 清除回落店铺配置；仅本渠道商品可改 */
    async setProductPackingFee(ctx, productId, packingFee) {
        const inChannel = await this.connection.getRepository(ctx, core_1.Product).createQueryBuilder('product')
            .leftJoin('product.channels', 'channel')
            .where('product.id = :id', { id: productId })
            .andWhere('channel.id = :ch', { ch: ctx.channelId })
            .getOne();
        if (!inChannel)
            throw new core_1.UserInputError('商品不存在或不属于当前店铺');
        let value = null;
        if (packingFee != null) {
            const n = Number(packingFee);
            if (!Number.isFinite(n) || n < 0)
                throw new core_1.UserInputError('打包费必须为不小于 0 的数字（分/件）');
            if (n > 100000)
                throw new core_1.UserInputError('打包费单件超出允许上限（100000 分 = 1000 元）');
            value = Math.round(n);
        }
        await this.connection.getRepository(ctx, core_1.Product).update(productId, {
            customFields: { waimaiPackingFee: value },
        });
        return { ok: true, packingFee: value };
    }
    /** 每日限量 / 每人限购（§68）：null 或 0 = 不限；每人限购不得大于每日限量 */
    async setProductLimit(ctx, productId, dailyLimit, perUserLimit) {
        var _a;
        await this.assertProductInChannel(ctx, productId);
        const daily = (0, daily_limit_1.normalizeLimit)(dailyLimit);
        const perUser = (0, daily_limit_1.normalizeLimit)(perUserLimit);
        for (const v of [dailyLimit, perUserLimit]) {
            if (v != null && Number(v) > daily_limit_1.DAILY_LIMIT_MAX) {
                throw new core_1.UserInputError(`限量最多 ${daily_limit_1.DAILY_LIMIT_MAX} 份`);
            }
            if (v != null && Number(v) < 0) {
                throw new core_1.UserInputError('限量不能为负数');
            }
        }
        if (daily != null && perUser != null && perUser > daily) {
            throw new core_1.UserInputError('每人限购不能大于每日限量');
        }
        await this.connection.getRepository(ctx, core_1.Product).update(productId, {
            customFields: { waimaiDailyLimit: daily, waimaiPerUserLimit: perUser },
        });
        const soldMap = await (0, daily_limit_1.queryDailySold)(this.connection.rawConnection, Number(ctx.channelId), [Number(productId)]);
        const soldToday = (_a = soldMap.get(Number(productId))) !== null && _a !== void 0 ? _a : 0;
        return {
            ok: true,
            dailyLimit: daily,
            perUserLimit: perUser,
            soldToday,
            remaining: (0, daily_limit_1.remainingOf)(daily, soldToday),
        };
    }
    /** 商品加料组（P1-2）：空数组=清除；清洗后再序列化，脏数据不入库 */
    async setProductAddonGroups(ctx, productId, rawGroups) {
        var _a, _b, _c, _d;
        await this.assertProductInChannel(ctx, productId);
        const cleaned = (0, addon_fee_1.parseAddonGroups)(rawGroups);
        // 显式上限校验：解析器会静默截断，这里对「用户确实提交了超限内容」直接报错更友好
        const inputCount = Array.isArray(rawGroups) ? rawGroups.length : 0;
        if (inputCount > addon_fee_1.ADDON_MAX_GROUPS) {
            throw new core_1.UserInputError(`加料组最多 ${addon_fee_1.ADDON_MAX_GROUPS} 组`);
        }
        for (const g of Array.isArray(rawGroups) ? rawGroups : []) {
            const opts = Array.isArray(g === null || g === void 0 ? void 0 : g.options) ? g.options : [];
            if (opts.length > addon_fee_1.ADDON_MAX_OPTIONS_PER_GROUP) {
                throw new core_1.UserInputError(`「${(_a = g === null || g === void 0 ? void 0 : g.name) !== null && _a !== void 0 ? _a : '加料'}」最多 ${addon_fee_1.ADDON_MAX_OPTIONS_PER_GROUP} 个选项`);
            }
            for (const o of opts) {
                const n = Number((_b = o === null || o === void 0 ? void 0 : o.price) !== null && _b !== void 0 ? _b : 0);
                if (Number.isFinite(n) && n > addon_fee_1.ADDON_MAX_PRICE_FEN) {
                    throw new core_1.UserInputError('单个加料价格不能超过 1000 元');
                }
                if (Number.isFinite(n) && n < 0) {
                    throw new core_1.UserInputError('加料价格不能为负数');
                }
            }
            const min = Number((_c = g === null || g === void 0 ? void 0 : g.min) !== null && _c !== void 0 ? _c : 0);
            const max = Number((_d = g === null || g === void 0 ? void 0 : g.max) !== null && _d !== void 0 ? _d : 0);
            if (min > 0 && max > 0 && min > max) {
                throw new core_1.UserInputError('「最少选」不能大于「最多选」');
            }
        }
        const value = (0, addon_fee_1.serializeAddonGroups)(cleaned);
        await this.connection.getRepository(ctx, core_1.Product).update(productId, {
            customFields: { waimaiAddonGroups: value },
        });
        return { ok: true, addonGroups: value };
    }
    /** 商品套餐内容（P1-2）：传 null/空 items=清除（非套餐商品） */
    async setProductCombo(ctx, productId, rawCombo) {
        await this.assertProductInChannel(ctx, productId);
        const inputItems = Array.isArray(rawCombo === null || rawCombo === void 0 ? void 0 : rawCombo.items) ? rawCombo.items : [];
        if (inputItems.length > addon_fee_1.COMBO_MAX_ITEMS) {
            throw new core_1.UserInputError(`套餐内含商品最多 ${addon_fee_1.COMBO_MAX_ITEMS} 项`);
        }
        const value = (0, addon_fee_1.serializeCombo)((0, addon_fee_1.parseCombo)(rawCombo));
        await this.connection.getRepository(ctx, core_1.Product).update(productId, {
            customFields: { waimaiCombo: value },
        });
        return { ok: true, combo: value };
    }
    /** 商品必须属于当前店铺渠道（越权防护：商家只能改本店商品） */
    async assertProductInChannel(ctx, productId) {
        const inChannel = await this.connection.getRepository(ctx, core_1.Product).createQueryBuilder('product')
            .leftJoin('product.channels', 'channel')
            .where('product.id = :id', { id: productId })
            .andWhere('channel.id = :ch', { ch: ctx.channelId })
            .getOne();
        if (!inChannel)
            throw new core_1.UserInputError('商品不存在或不属于当前店铺');
    }
    async assertAnyChannelOrder(ctx, orderId) {
        var _a;
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['channels'],
        });
        const inChannel = (_a = order === null || order === void 0 ? void 0 : order.channels) === null || _a === void 0 ? void 0 : _a.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel)
            throw new core_1.UserInputError('订单不存在或不属于当前店铺');
        return order;
    }
    async assertChannelOrder(ctx, orderId, expect) {
        return this.assertChannelOrderState(ctx, orderId, [expect]);
    }
    async assertChannelOrderState(ctx, orderId, expects) {
        var _a;
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['channels'],
        });
        const inChannel = (_a = order === null || order === void 0 ? void 0 : order.channels) === null || _a === void 0 ? void 0 : _a.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel)
            throw new core_1.UserInputError('订单不存在或不属于当前店铺');
        const hs = order.customFields.hallStatus;
        if (!expects.includes(hs)) {
            throw new core_1.UserInputError('当前状态不允许该操作');
        }
        return order;
    }
    /** 组装商家视图 DTO：楼栋名批量查、骑手名批量查，不外泄 admin 内部字段 */
    async toDto(ctx, orders) {
        const buildingIds = new Set();
        const riderIds = new Set();
        for (const o of orders) {
            const cf = o.customFields;
            if (cf.buildingId)
                buildingIds.add(String(cf.buildingId));
            if (cf.deliveryStaffId)
                riderIds.add(Number(cf.deliveryStaffId));
        }
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, campus_building_entity_1.CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        const customers = riderIds.size
            ? await this.connection.rawConnection.getRepository('Customer').findByIds([...riderIds])
            : [];
        const riderNames = new Map(customers.map(c => { var _a, _b; return [String(c.id), (_b = (_a = c.customFields) === null || _a === void 0 ? void 0 : _a.riderRealName) !== null && _b !== void 0 ? _b : '']; }));
        // 催单「已知晓」时间（§78）：一次批量查，避免逐单查库
        const ackMap = await this.urgeAckMap(ctx, orders.map(o => Number(o.id)));
        return orders.map(o => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const cf = o.customFields;
            const urgedAt = cf.urgedAt ? new Date(cf.urgedAt) : null;
            return {
                id: String(o.id),
                code: o.code,
                createdAt: o.createdAt,
                total: o.total,
                shipping: o.shipping,
                building: cf.buildingId ? (_a = buildingNames.get(String(cf.buildingId))) !== null && _a !== void 0 ? _a : '' : '',
                zone: (_b = cf.campusZone) !== null && _b !== void 0 ? _b : '',
                slotText: (_c = cf.deliverySlotText) !== null && _c !== void 0 ? _c : '',
                route: (_d = cf.fulfillmentRoute) !== null && _d !== void 0 ? _d : '',
                riderName: cf.deliveryStaffId ? (_e = riderNames.get(String(cf.deliveryStaffId))) !== null && _e !== void 0 ? _e : null : null,
                note: (_f = cf.note) !== null && _f !== void 0 ? _f : null,
                printedAt: (_g = cf.waimaiPrintedAt) !== null && _g !== void 0 ? _g : null,
                provider: cf.thirdPartyProvider || null,
                thirdPartyNo: cf.thirdPartyNo || null,
                handoverCode: cf.handoverCode || null,
                urged: isUrgePending(cf.urged, urgedAt, (_h = ackMap.get(String(o.id))) !== null && _h !== void 0 ? _h : null),
                urgedAt,
                // 脱敏口径与号码保护一致：11 位保留前 3 后 4，绝不外泄明文
                customerPhone: this.privacy.mask((_k = (_j = o.customer) === null || _j === void 0 ? void 0 : _j.phoneNumber) !== null && _k !== void 0 ? _k : null),
                lines: ((_l = o.lines) !== null && _l !== void 0 ? _l : []).map(l => {
                    var _a, _b;
                    return ({
                        name: (_b = (_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '',
                        quantity: l.quantity,
                        price: l.unitPrice,
                    });
                }),
            };
        });
    }
};
exports.MerchantAdminService = MerchantAdminService;
exports.MerchantAdminService = MerchantAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        campus_config_service_1.CampusConfigService,
        hall_service_1.HallService,
        campus_notify_service_1.CampusNotifyService,
        third_party_delivery_service_1.ThirdPartyDeliveryService,
        core_1.OrderService,
        privacy_number_service_1.PrivacyNumberService,
        cloud_print_service_1.CloudPrintService])
], MerchantAdminService);
/** 催单是否仍未处理（§78）：顾客置了 urged 且「已知晓」时间早于最近一次催单（顾客再催会重新变为待处理） */
function isUrgePending(urged, urgedAt, ackedAt) {
    if (urged !== true || !urgedAt)
        return false;
    return !ackedAt || ackedAt.getTime() < urgedAt.getTime();
}
//# sourceMappingURL=merchant-admin.service.js.map