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
        var _a, _b, _c, _d;
        const cfg = await this.config.getConfig(ctx);
        const channel = await this.connection.getRepository(ctx, core_1.Channel)
            .findOne({ where: { id: ctx.channelId } });
        if (!channel)
            throw new core_1.UserInputError('当前店铺渠道不存在');
        const hours = (_b = ((_a = channel.customFields) !== null && _a !== void 0 ? _a : {}).waimaiBusinessHours) !== null && _b !== void 0 ? _b : null;
        return {
            storeName: channel.code,
            businessHours: hours,
            storeNotice: (_c = cfg.storeNotice) !== null && _c !== void 0 ? _c : null,
            storePhone: (_d = cfg.storePhone) !== null && _d !== void 0 ? _d : null,
            paused: cfg.paused,
            // 与 C 端 openNow / 下单闸门同口径：营业时段内且未临时休息
            openNow: (0, business_hours_1.isWithinBusinessHours)(hours) && !cfg.paused,
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
    async board(ctx) {
        var _a, _b, _c, _d;
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
        return {
            paused: cfg.paused,
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
        };
    }
    /** 商家接单确认：pending_merchant → accepted */
    async acceptOrder(ctx, orderId) {
        var _a;
        const order = await this.assertChannelOrder(ctx, orderId, 'pending_merchant');
        // 条件写：与用户取消/调度商家超时兜底并发时，已脱厅单不得被改回 accepted
        const moved = await this.hall.transitionFrom(ctx, Number(order.id), ['pending_merchant'], {
            hallStatus: 'accepted',
        });
        if (!moved)
            throw new core_1.UserInputError('订单状态已变更，请刷新');
        this.notify.user(ctx, order.id, 'orderAccepted');
        // 云打印（P1-4）：接单即出票（printMode=onAccepted 且走云通道）；失败只留任务记录，不阻塞接单
        const cfg = await this.config.getConfig(ctx);
        if ((0, waimai_store_service_1.normalizePrintMode)(cfg.printMode) === 'onAccepted' && String((_a = cfg.printProvider) !== null && _a !== void 0 ? _a : 'local') !== 'local') {
            void this.cloud.printOrder(ctx, order.id, 'auto').catch(() => undefined);
        }
        return { ok: true };
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
        const tickets = orders.map(o => {
            var _a, _b, _c, _d, _e, _f;
            const cf = o.customFields;
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
                lines: ((_f = o.lines) !== null && _f !== void 0 ? _f : []).map(l => {
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
        return {
            tickets,
            pendingCount: tickets.filter(t => t.stage === 'pending').length,
            cookingCount: tickets.filter(t => t.stage === 'cooking').length,
            lateCount: tickets.filter(t => t.urgency === 'late').length,
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
        return {
            items: (list !== null && list !== void 0 ? list : []).map((r) => {
                var _a, _b;
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
        const count = Array.isArray(list) ? list.length : 0;
        return { ok: true, soldOut: flag, count };
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
        return orders.map(o => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const cf = o.customFields;
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
                lines: ((_h = o.lines) !== null && _h !== void 0 ? _h : []).map(l => {
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
//# sourceMappingURL=merchant-admin.service.js.map