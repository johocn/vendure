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
exports.MerchantAdminService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_config_service_1 = require("./campus-config.service");
const campus_notify_service_1 = require("./campus-notify.service");
const campus_time_1 = require("./campus-time");
const hall_service_1 = require("./hall.service");
const refund_payment_1 = require("./refund-payment");
const third_party_delivery_service_1 = require("./third-party-delivery.service");
const waimai_store_service_1 = require("./waimai-store.service");
/**
 * 商家接单工作台（admin-api，CampusMerchant 权限，渠道隔离 = 商家角色绑定渠道）。
 * 状态机（merchantConfirmEnabled 渠道）：支付 → pending_merchant（待商家接单）
 * → accepted（备餐中，campusMerchantAcceptOrder）→ open（出餐完成入大厅，
 * campusMerchantCookingDone）→ 骑手 grabbed/delivering → delivered。
 */
let MerchantAdminService = class MerchantAdminService {
    constructor(connection, config, hall, notify, thirdParty, orderService) {
        this.connection = connection;
        this.config = config;
        this.hall = hall;
        this.notify = notify;
        this.thirdParty = thirdParty;
        this.orderService = orderService;
    }
    async board(ctx) {
        var _a, _b, _c;
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
        return {
            paused: cfg.paused,
            merchantConfirmEnabled: cfg.merchantConfirmEnabled,
            printMode: (0, waimai_store_service_1.normalizePrintMode)(cfg.printMode),
            storeName: (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : '',
            storePhone: (_c = cfg.storePhone) !== null && _c !== void 0 ? _c : null,
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
        const order = await this.assertChannelOrder(ctx, orderId, 'pending_merchant');
        // 条件写：与用户取消/调度商家超时兜底并发时，已脱厅单不得被改回 accepted
        const moved = await this.hall.transitionFrom(ctx, Number(order.id), ['pending_merchant'], {
            hallStatus: 'accepted',
        });
        if (!moved)
            throw new core_1.UserInputError('订单状态已变更，请刷新');
        this.notify.user(ctx, order.id, 'orderAccepted');
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
                    await this.orderService.settleRefund(ctx, { id: created.id });
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
        core_1.OrderService])
], MerchantAdminService);
//# sourceMappingURL=merchant-admin.service.js.map