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
var DispatchJobService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchJobService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const capacity_service_1 = require("./capacity.service");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const feishu_notify_service_1 = require("./feishu/feishu-notify.service");
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
const third_party_delivery_service_1 = require("./third-party-delivery.service");
const rider_credit_service_1 = require("./rider-credit.service");
const NOT_PICKED_TIMEOUT_MIN = 15;
/** 外部运单轮询对账间隔（防平台回调丢失）：每单 5min 一次主动查询 */
const EXTERNAL_SYNC_INTERVAL_MIN = 5;
/** 超时赔付扫描：仅处理近 24h 送达单，单轮上限防长事务 */
const TIMEOUT_COMPENSATION_WINDOW_H = 24;
const TIMEOUT_COMPENSATION_LIMIT = 200;
// F6 单渠道单轮扫描上限：按 createdAt 升序截断（最老的最紧急），超限告警暴露积压
const SCAN_LIMIT = 200;
let DispatchJobService = DispatchJobService_1 = class DispatchJobService {
    constructor(connection, grab, hall, capacity, credit, moduleRef, thirdParty, feishu) {
        this.connection = connection;
        this.grab = grab;
        this.hall = hall;
        this.capacity = capacity;
        this.credit = credit;
        this.moduleRef = moduleRef;
        this.thirdParty = thirdParty;
        this.feishu = feishu;
        this.timer = null;
        this.running = false;
        /** 超时赔付缺配置告警限频（避免每分钟刷日志） */
        this.compensationWarnAt = 0;
    }
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    get injector() {
        return new core_2.Injector(this.moduleRef);
    }
    start(intervalMs = 60000) {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            this.tick().catch(e => core_2.Logger.error(`dispatch tick: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusDispatch'));
        }, intervalMs);
    }
    onApplicationShutdown() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
    }
    async tick() {
        if (this.running)
            return; // 上一轮未结束跳过
        this.running = true;
        try {
            // 扫描跨渠道：逐渠道配置构造真实 RequestContext（getRepository 仅接受 RequestContext 实例）
            const cfgs = await this.connection.rawConnection
                .getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig)
                .find();
            for (const cfg of cfgs) {
                await this.scanChannelWithLock(cfg.channelId);
            }
        }
        finally {
            this.running = false;
        }
    }
    /**
     * 按渠道加扫描锁：多实例幂等（pm2 多进程/多副本时同一渠道同一轮只允许一个实例扫描），
     * 同时把渠道间故障隔离——单渠道扫描抛错不再中断其余渠道（上一版全局锁整体串行，渠道多时
     * 一轮超 60s 会被 running 标志跳过，造成积压）。
     */
    async scanChannelWithLock(channelId) {
        var _a;
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:dispatch:scan:${channelId}`;
        try {
            const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.ok))
                return;
            try {
                await this.scan(await this.ctxForChannel(channelId));
            }
            catch (e) {
                core_2.Logger.error(`dispatch scan failed for channel ${channelId}: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusDispatch');
            }
        }
        finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            }
            catch (_b) {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }
    async ctxForChannel(channelId) {
        var _a;
        // 必须查完整 Channel 实体（含 defaultTaxZone）：手工 new Channel({id}) 无 taxZone，
        // order-calculator 重算价时 taxZoneStrategy.determineTaxZone 返回 undefined → error.no-active-tax-zone
        const channel = (_a = (await this.connection.rawConnection.getRepository(core_2.Channel).findOne({
            where: { id: channelId },
            relations: ['defaultTaxZone'],
        }))) !== null && _a !== void 0 ? _a : new core_2.Channel({ id: channelId });
        return new core_2.RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }
    /**
     * 扫描当前 ctx 渠道：
     * 1) assigned 超 15min 未取货 → 回大厅 + 骑手扣分
     * 2) open 超 autoAssignMinutes → 强派最佳在线骑手（T2）
     * （T4 退款扫描在 Task 8 追加到此方法）
     */
    async scan(ctx) {
        var _a, _b, _c, _d, _e;
        const repo = this.connection.getRepository(ctx, core_2.Order);
        const orders = await repo.createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere("order.customFields.hallStatus IN ('open', 'grabbed', 'pending_merchant', 'accepted', 'scheduled', 'pending_dispatch', 'third_party', 'owned_pool', 'owned_dispatched', 'merchant_delivering')")
            // 已取消单即使 hallStatus 未及时清也绝不参与扫描：所有兜底写都必须落在活单上
            .andWhere('order.state != :cancelled', { cancelled: 'Cancelled' })
            // 预约单排序靠后（P2-8）：它们与活单混排时不得挤占 take 窗口，
            // 否则大量未到点的预约单会把 open 强派/T4 退款扫出窗口。预约单内部按 scheduledFor 升序。
            .orderBy("CASE WHEN order.customFields.hallStatus = 'scheduled' THEN 1 ELSE 0 END", 'ASC')
            .addOrderBy("CASE WHEN order.customFields.hallStatus = 'scheduled' "
            + 'THEN order.customFields.scheduledFor ELSE order.createdAt END', 'ASC')
            .take(SCAN_LIMIT)
            .getMany();
        if (orders.length >= SCAN_LIMIT) {
            core_2.Logger.warn(`channel ${ctx.channelId} dispatch backlog: >=${SCAN_LIMIT} in-flight orders, scan truncated (oldest-first)`, 'CampusDispatch');
        }
        const now = Date.now();
        // 1) assigned 超 15min 未取货 → 回大厅 + 扣分
        for (const o of orders) {
            const cf = o.customFields;
            if (cf.hallStatus === 'grabbed' && cf.deliveryStatus === 'assigned' && cf.assignedAt) {
                if (now - new Date(cf.assignedAt).getTime() > NOT_PICKED_TIMEOUT_MIN * 60000) {
                    // 条件回厅：并发取消/送达时不得把终态单改回 open，也不应再扣骑手信用分
                    const back = await this.hall.backToHall(ctx, o.id);
                    if (!back)
                        continue;
                    await this.credit.adjust(ctx, Number(cf.deliveryStaffId), rider_credit_service_1.CREDIT_TIMEOUT, 'timeout_not_picked', o.id);
                    core_2.Logger.warn(`Order ${o.code} reassigned (rider ${cf.deliveryStaffId} not picked in ${NOT_PICKED_TIMEOUT_MIN}min)`, 'CampusDispatch');
                }
            }
        }
        // 2) T2 强派（无在线骑手时跳过，不阻断 T4）
        const cfg = await this.connection
            .getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId } });
        if (cfg) {
            // 0) 预约单放量（plan 3.1）：到 scheduledFor 前 30min 才进入商家确认/大厅
            const toRelease = orders.filter(o => {
                const cf = o.customFields;
                if (cf.hallStatus !== 'scheduled')
                    return false;
                const t = cf.scheduledFor ? new Date(cf.scheduledFor).getTime() : NaN;
                return !Number.isNaN(t) && t - now <= hall_service_1.HallService.SCHEDULE_RELEASE_MIN * 60000;
            });
            for (const o of toRelease) {
                const released = await this.hall.releaseScheduled(ctx, o, cfg);
                if (!released)
                    continue; // 并发下已不是 scheduled（取消/已放量），本轮跳过
                // 内存同步防同轮 T2/T4 误处理：释放即离开 scheduled 态，入口统一按 releaseTarget 决定；
                // 同时刷新 hallEnteredAt 作计时锚点（否则下游按 createdAt 判定，预约单一放量就被判超时）
                const cf = o.customFields;
                cf.hallStatus = hall_service_1.HallService.releaseTarget(cf, cfg);
                cf.hallEnteredAt = new Date();
            }
            // 路线兜底（R1/R2/R3）：商户接单超时转自营、送达超时回落大厅、外部快递推送/接单超时
            await this.sweepRouteTimeouts(ctx, cfg, orders, now);
            // 异常上报超时未处置：自动回大厅重派，避免卡死在 exception
            await this.sweepExceptionTimeout(ctx, cfg, orders, now);
            // 超时赔付：送达超承诺 → 自动发定向券（开关默认关）
            await this.sweepTimeoutCompensation(ctx, cfg, now);
            // 商家确认模式卡单兜底：待接单/备餐中超 merchantAutoOpenMinutes 自动入厅
            // （跳过商家确认，campusCause 留痕；计时锚 hallEnteredAt：预约单 createdAt 可能早于放量数小时）
            if (cfg.merchantConfirmEnabled) {
                const merchantStale = orders.filter(o => {
                    var _a, _b;
                    const cf = o.customFields;
                    return (cf.hallStatus === 'pending_merchant' || cf.hallStatus === 'accepted')
                        && now - new Date((_a = cf.hallEnteredAt) !== null && _a !== void 0 ? _a : o.createdAt).getTime()
                            > ((_b = cfg.merchantAutoOpenMinutes) !== null && _b !== void 0 ? _b : 15) * 60000;
                });
                for (const o of merchantStale) {
                    const enteredAt = new Date();
                    const moved = await this.hall.transitionFrom(ctx, Number(o.id), ['pending_merchant', 'accepted'], { hallStatus: 'open', hallEnteredAt: enteredAt, campusCause: 'merchant_timeout' });
                    if (!moved)
                        continue; // 期间已被商家接单/取消
                    core_2.Logger.warn(`Order ${o.code} auto-opened (merchant not responding)`, 'CampusDispatch');
                    const cf = o.customFields;
                    cf.hallStatus = 'open';
                    cf.hallEnteredAt = enteredAt; // 同步锚点，避免同轮 T2 按旧锚点立即强派
                }
            }
            // T1.5 多单顺路打包（plan 3.3）：同楼栋+同时段 open 配送单写同一 routeGroupId，
            // 后续 T2 强派逐单派给同一骑手天然同车；骑手抢单由 HallGrabService.grab 整组接走。
            await this.packRoutes(ctx, orders);
            const riders = await this.capacity.listOnlineRiders(ctx);
            const eligible = riders
                .filter(r => { var _a; return ((_a = r.customFields.riderCredit) !== null && _a !== void 0 ? _a : 100) >= rider_credit_service_1.CREDIT_LIMIT; })
                .sort((a, b) => {
                var _a, _b;
                const ca = (_a = a.customFields.riderCredit) !== null && _a !== void 0 ? _a : 100;
                const cb = (_b = b.customFields.riderCredit) !== null && _b !== void 0 ? _b : 100;
                if (cb !== ca)
                    return cb - ca; // 信用分高者优先
                const ta = new Date(a.customFields.riderOnlineAt).getTime();
                const tb = new Date(b.customFields.riderOnlineAt).getTime();
                return tb - ta; // 最近活跃优先
            });
            if (eligible.length) {
                // 在途负载：同一骑手已持有的配送中订单数（T2 轮转派单，避免所有超时单全塞给信用最高的一人）
                const load = new Map();
                for (const o of orders) {
                    const cf = o.customFields;
                    const rid = Number((_a = cf.deliveryStaffId) !== null && _a !== void 0 ? _a : NaN);
                    if (!Number.isFinite(rid) || !rid)
                        continue;
                    const active = ['assigned', 'in_progress'].includes(String((_b = cf.deliveryStatus) !== null && _b !== void 0 ? _b : ''))
                        || ['grabbed', 'owned_dispatched'].includes(String((_c = cf.hallStatus) !== null && _c !== void 0 ? _c : ''));
                    if (!active)
                        continue;
                    load.set(rid, ((_d = load.get(rid)) !== null && _d !== void 0 ? _d : 0) + 1);
                }
                const pickRider = () => {
                    var _a, _b;
                    // eligible 已按「信用分高→最近活跃」排序：仅负载严格更低时才换人，平局保持原优先级
                    let best = eligible[0];
                    let bestLoad = (_a = load.get(Number(best.id))) !== null && _a !== void 0 ? _a : 0;
                    for (const r of eligible) {
                        const l = (_b = load.get(Number(r.id))) !== null && _b !== void 0 ? _b : 0;
                        if (l < bestLoad) {
                            best = r;
                            bestLoad = l;
                        }
                    }
                    return best;
                };
                const stale = orders.filter(o => {
                    var _a;
                    const cf = o.customFields;
                    return cf.hallStatus === 'open' && this.orderInChannel(o, cfg) && cf.hallEnteredAt
                        && now - new Date(cf.hallEnteredAt).getTime() > ((_a = cfg.autoAssignMinutes) !== null && _a !== void 0 ? _a : 10) * 60000;
                }).sort((a, b) => new Date(a.customFields.hallEnteredAt).getTime()
                    - new Date(b.customFields.hallEnteredAt).getTime());
                for (const o of stale) {
                    const rider = pickRider();
                    const ok = await this.grab.grabByRider(ctx, o.id, rider);
                    if (ok) {
                        load.set(Number(rider.id), ((_e = load.get(Number(rider.id))) !== null && _e !== void 0 ? _e : 0) + 1);
                        core_2.Logger.warn(`Order ${o.code} auto-assigned to rider ${rider.id} (T2)`, 'CampusDispatch');
                    }
                    // 无论成败，该单已离开 open 大厅（成功→grabbed；失败→已被抢/已退款），
                    // 内存标记防止同轮 T4 对已派单误退款（grabByRider 事务内有二次校验兜底）。
                    o.customFields.hallStatus = 'grabbed';
                }
            }
            // 3) T4: open 超 autoRefundMinutes 无人接 → 自动退款终态（降级阶梯最后一级）
            const staleFinal = orders.filter(o => {
                var _a;
                const cf = o.customFields;
                return cf.hallStatus === 'open' && cf.hallEnteredAt
                    && now - new Date(cf.hallEnteredAt).getTime() > ((_a = cfg.autoRefundMinutes) !== null && _a !== void 0 ? _a : 30) * 60000;
            });
            for (const o of staleFinal) {
                await this.refundNoRider(ctx, o, cfg);
            }
        }
    }
    /**
     * 异常上报超时升级：骑手上报异常后运营未在 SLA 内处置（inProgressSlaMinutes，默认 45）→
     * 自动回大厅重新派单（等价运营「重派」处置），避免订单卡死在 exception 占用骑手与履约时效。
     * 单条 CAS 完成「回厅 + 清异常痕迹」：类型/照片/说明保留供追责存疑——不，重派即新骑手接手，
     * 旧骑手的异常标记必须清掉，否则新骑手端会继续显示「异常单」且本轮会再次命中本规则。
     * 异常类型/说明随订单日志已留痕；campusCause=exception_timeout 供运营复盘。
     */
    async sweepExceptionTimeout(ctx, cfg, orders, now) {
        var _a, _b, _c, _d;
        const slaMs = ((_a = cfg.inProgressSlaMinutes) !== null && _a !== void 0 ? _a : 45) * 60000;
        for (const o of orders) {
            const cf = o.customFields;
            if (cf.deliveryStatus !== 'exception')
                continue;
            const at = cf.exceptionReportedAt ? new Date(cf.exceptionReportedAt).getTime() : NaN;
            if (Number.isNaN(at) || now - at <= slaMs)
                continue;
            const enteredAt = new Date();
            const moved = await this.hall.transitionFrom(ctx, Number(o.id), hall_service_1.ACTIVE_HALL_STATUSES, {
                hallStatus: 'open',
                hallEnteredAt: enteredAt, // 重置避免同轮 T4 立即按超时退款
                deliveryStatus: null,
                deliveryStaffId: null,
                assignedAt: null,
                exceptionType: null,
                exceptionPhotos: null,
                exceptionNote: null,
                exceptionReportedAt: null,
                campusCause: 'exception_timeout',
            });
            if (!moved)
                continue; // 期间已取消/已送达
            cf.hallStatus = 'open';
            cf.deliveryStatus = null;
            cf.hallEnteredAt = enteredAt;
            cf.exceptionReportedAt = null;
            core_2.Logger.warn(`Order ${o.code} exception not handled in ${(_b = cfg.inProgressSlaMinutes) !== null && _b !== void 0 ? _b : 45}min → back to hall`, 'CampusDispatch');
            void ((_c = this.feishu) === null || _c === void 0 ? void 0 : _c.pushEvent('exception', '异常超时自动回厅', `订单 ${o.code} 异常上报 ${(_d = cfg.inProgressSlaMinutes) !== null && _d !== void 0 ? _d : 45} 分钟未处置，已回大厅重新派单。`, o.code, o.code));
        }
    }
    /**
     * 路线超时兜底：
     * 1) R1 pending_merchant 超 merchantAcceptMinutes → 自动转自营快递（owned_dispatched）
     * 2) merchant_delivering 超 merchantAutoOpenMinutes → 回抢单大厅（传信者到档口取餐）
     * 3) pending_dispatch 超 externalPushTimeoutMinutes → 回抢单大厅
     * 4) third_party 超 externalFallbackMinutes → 取消外部快递；R2 回待推送换一家，R3 回大厅
     *    （平台已接单/取货不按该阈值取消，仅 3× 硬上限兜底）
     * 5) owned_pool 超 merchantAutoOpenMinutes 无人接 → 回大厅
     * 6) owned_dispatched 超 merchantAutoOpenMinutes 未送达交接点 → 回大厅并清空骑手
     */
    async sweepRouteTimeouts(ctx, cfg, orders, now) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
        const minutes = (v, def) => (v !== null && v !== void 0 ? v : def) * 60000;
        const acceptMs = minutes(cfg.merchantAcceptMinutes, 5);
        const deliverMs = minutes(cfg.merchantAutoOpenMinutes, 15);
        const pushMs = minutes(cfg.externalPushTimeoutMinutes, 10);
        const fallbackMs = minutes(cfg.externalFallbackMinutes, 20);
        for (const o of orders) {
            const cf = o.customFields;
            const route = String((_a = cf.fulfillmentRoute) !== null && _a !== void 0 ? _a : '');
            // 1) 商户接单超时 → R1 转自营快递；R2 降级传信者到店取餐直送（外部快递无餐可取，不能推）
            //    计时锚 hallEnteredAt：预约单 createdAt 可能早于放量数小时，必须从放量/入厅时刻起算
            if (cf.hallStatus === 'pending_merchant' && (route === 'R1' || route === 'R2') && acceptMs > 0
                && now - new Date((_b = cf.hallEnteredAt) !== null && _b !== void 0 ? _b : o.createdAt).getTime() > acceptMs) {
                if (route === 'R1') {
                    const moved = await this.hall.transitionFrom(ctx, Number(o.id), ['pending_merchant'], {
                        hallStatus: 'owned_dispatched',
                        deliveryPlan: 'owned',
                        assignedAt: new Date(),
                        campusCause: 'merchant_accept_timeout',
                    });
                    if (!moved)
                        continue;
                    core_2.Logger.warn(`Order ${o.code} merchant accept timeout → owned courier`, 'CampusDispatch');
                    void ((_c = this.feishu) === null || _c === void 0 ? void 0 : _c.pushEvent('exception', '商户接单超时（转自营）', `订单 ${o.code} 商户 ${(_d = cfg.merchantAcceptMinutes) !== null && _d !== void 0 ? _d : 5} 分钟未接单，已转自营快递。`, o.code, o.code));
                    cf.hallStatus = 'owned_dispatched';
                    cf.deliveryPlan = 'owned';
                }
                else {
                    const moved = await this.hall.transitionFrom(ctx, Number(o.id), ['pending_merchant'], {
                        hallStatus: 'open',
                        hallEnteredAt: new Date(),
                        deliveryPlan: 'campus_rider',
                        handoverMode: '',
                        campusCause: 'merchant_accept_timeout',
                    });
                    if (!moved)
                        continue;
                    core_2.Logger.warn(`Order ${o.code} merchant accept timeout (R2) → hall`, 'CampusDispatch');
                    void ((_e = this.feishu) === null || _e === void 0 ? void 0 : _e.pushEvent('exception', '商户接单超时（回大厅）', `订单 ${o.code} 商户 ${(_f = cfg.merchantAcceptMinutes) !== null && _f !== void 0 ? _f : 5} 分钟未接单，已回抢单大厅。`, o.code, o.code));
                    cf.hallStatus = 'open';
                    cf.deliveryPlan = 'campus_rider';
                    cf.hallEnteredAt = new Date();
                }
                continue;
            }
            // 1b) R2 已接单但久未出餐（出餐闸门卡住）→ 降级传信者到店取餐直送
            if (cf.hallStatus === 'accepted' && route === 'R2'
                && now - new Date((_g = cf.hallEnteredAt) !== null && _g !== void 0 ? _g : o.createdAt).getTime() > deliverMs) {
                const moved = await this.hall.transitionFrom(ctx, Number(o.id), ['accepted'], {
                    hallStatus: 'open',
                    hallEnteredAt: new Date(),
                    deliveryPlan: 'campus_rider',
                    handoverMode: '',
                    campusCause: 'merchant_cooking_timeout',
                });
                if (!moved)
                    continue;
                core_2.Logger.warn(`Order ${o.code} R2 cooking timeout → hall`, 'CampusDispatch');
                void ((_h = this.feishu) === null || _h === void 0 ? void 0 : _h.pushEvent('exception', '商户出餐超时', `订单 ${o.code} 商户 ${(_j = cfg.merchantAutoOpenMinutes) !== null && _j !== void 0 ? _j : 15} 分钟未出餐，已回抢单大厅。`, o.code, o.code));
                cf.hallStatus = 'open';
                cf.deliveryPlan = 'campus_rider';
                cf.hallEnteredAt = new Date();
                continue;
            }
            // 2) 商户久未送达交接点 → 回大厅（传信者到档口取餐直送）
            if (cf.hallStatus === 'merchant_delivering' && cf.assignedAt
                && now - new Date(cf.assignedAt).getTime() > deliverMs) {
                const enteredAt = new Date();
                const moved = await this.hall.transitionFrom(ctx, Number(o.id), ['merchant_delivering'], {
                    hallStatus: 'open',
                    hallEnteredAt: enteredAt,
                    deliveryPlan: 'campus_rider',
                    handoverMode: '',
                    campusCause: 'merchant_deliver_timeout',
                });
                if (!moved)
                    continue;
                core_2.Logger.warn(`Order ${o.code} merchant deliver timeout → hall`, 'CampusDispatch');
                void ((_k = this.feishu) === null || _k === void 0 ? void 0 : _k.pushEvent('exception', '商户送达交接点超时', `订单 ${o.code} 商户 ${(_l = cfg.merchantAutoOpenMinutes) !== null && _l !== void 0 ? _l : 15} 分钟未送达交接点，已回抢单大厅。`, o.code, o.code));
                cf.hallStatus = 'open';
                cf.hallEnteredAt = enteredAt;
                continue;
            }
            // 3) 迟迟未推送外部快递 → 回大厅（R2 出餐闸门后从出餐时刻计时，避免把备餐时间算进超时）
            if (cf.hallStatus === 'pending_dispatch'
                && now - new Date((_p = (_o = (_m = cf.assignedAt) !== null && _m !== void 0 ? _m : cf.thirdPartyDispatchAt) !== null && _o !== void 0 ? _o : cf.hallEnteredAt) !== null && _p !== void 0 ? _p : o.createdAt).getTime() > pushMs) {
                const enteredAt = new Date();
                const moved = await this.hall.transitionFrom(ctx, Number(o.id), ['pending_dispatch'], {
                    hallStatus: 'open',
                    hallEnteredAt: enteredAt,
                    deliveryPlan: 'campus_rider',
                    handoverMode: '',
                    campusCause: 'external_push_timeout',
                });
                if (!moved)
                    continue;
                core_2.Logger.warn(`Order ${o.code} external push timeout → hall`, 'CampusDispatch');
                void ((_q = this.feishu) === null || _q === void 0 ? void 0 : _q.pushEvent('exception', '外部快递推送超时', `订单 ${o.code} ${(_r = cfg.externalPushTimeoutMinutes) !== null && _r !== void 0 ? _r : 10} 分钟未推送外部快递，已回抢单大厅。`, o.code, o.code));
                cf.hallStatus = 'open';
                cf.hallEnteredAt = enteredAt;
                continue;
            }
            // 4) 已推送但久未接单/取货 → 取消并回落。
            //    平台已接单/取货（accepted/pickup）不按 fallbackMs 取消，避免把在途骑手干掉；
            //    但仍设 3×fallbackMs 硬上限，防止「接单后永不送达」永久占用。
            const tpState = String((_s = cf.thirdPartyState) !== null && _s !== void 0 ? _s : '');
            const inDelivery = tpState === 'accepted' || tpState === 'pickup';
            const tpElapsed = cf.thirdPartyDispatchAt
                ? now - new Date(cf.thirdPartyDispatchAt).getTime()
                : 0;
            const tpStale = cf.thirdPartyDispatchAt
                && ((!inDelivery && tpElapsed > fallbackMs) || tpElapsed > fallbackMs * 3);
            if (cf.hallStatus === 'third_party' && tpStale) {
                // 取消失败绝不回落/重推：外部运单仍有效，回落后再推会产生双运单双份运费。
                // 保持 third_party 留痕并下轮重试取消，直到平台确认取消。
                let cancelOk = true;
                // 无外部网关：没有需要取消的运单，本地直接回落
                let skipped = !this.thirdParty;
                if (this.thirdParty) {
                    try {
                        const res = await this.thirdParty.cancel(ctx, Number(o.id), 'external fallback timeout');
                        cancelOk = !!(res === null || res === void 0 ? void 0 : res.ok);
                        skipped = !!(res === null || res === void 0 ? void 0 : res.skipped);
                    }
                    catch (e) {
                        cancelOk = false;
                        core_2.Logger.error(`Order ${o.code} cancel external failed: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusDispatch');
                    }
                }
                if (!cancelOk) {
                    await this.hall.transitionFrom(ctx, Number(o.id), ['third_party'], {
                        campusCause: 'external_cancel_failed',
                    });
                    core_2.Logger.error(`Order ${o.code} external cancel not confirmed; stay third_party and retry (no fallback to avoid duplicate delivery)`, 'CampusDispatch');
                    continue;
                }
                // cancel() 成功时内部已按路线回写本地状态（R2 待推送 / R3 大厅）；未推送（skipped）时本地补写
                if (skipped) {
                    const patch = route === 'R2'
                        ? { hallStatus: 'pending_dispatch', thirdPartyDispatchAt: new Date(), thirdPartyState: 'cancelled', campusCause: 'external_fallback' }
                        : { hallStatus: 'open', hallEnteredAt: new Date(), deliveryPlan: 'campus_rider', handoverMode: '', thirdPartyState: 'cancelled', campusCause: 'external_fallback' };
                    await this.hall.transitionFrom(ctx, Number(o.id), ['third_party'], patch);
                }
                if (route === 'R2') {
                    cf.hallStatus = 'pending_dispatch';
                    cf.thirdPartyDispatchAt = new Date();
                }
                else {
                    cf.hallStatus = 'open';
                    cf.hallEnteredAt = new Date();
                }
                cf.thirdPartyState = 'cancelled';
                core_2.Logger.warn(`Order ${o.code} external fallback (${route})`, 'CampusDispatch');
                void ((_t = this.feishu) === null || _t === void 0 ? void 0 : _t.pushEvent('exception', '外部快递超时回落', `订单 ${o.code} 外部快递 ${(_u = cfg.externalFallbackMinutes) !== null && _u !== void 0 ? _u : 20} 分钟未接单/取货，已回落（${route}）。`, o.code, `${o.code}:fallback`));
            }
            // 5) 自营快递池久无人接单 → 回抢单大厅（传信者兜底）
            if (cf.hallStatus === 'owned_pool'
                && now - new Date((_v = cf.hallEnteredAt) !== null && _v !== void 0 ? _v : o.createdAt).getTime() > deliverMs) {
                const enteredAt = new Date();
                const moved = await this.hall.transitionFrom(ctx, Number(o.id), ['owned_pool'], {
                    hallStatus: 'open',
                    hallEnteredAt: enteredAt,
                    deliveryPlan: 'campus_rider',
                    handoverMode: '',
                    campusCause: 'owned_pool_timeout',
                });
                if (!moved)
                    continue;
                core_2.Logger.warn(`Order ${o.code} owned pool timeout → hall`, 'CampusDispatch');
                void ((_w = this.feishu) === null || _w === void 0 ? void 0 : _w.pushEvent('exception', '自营快递无人接单', `订单 ${o.code} 自营快递池 ${(_x = cfg.merchantAutoOpenMinutes) !== null && _x !== void 0 ? _x : 15} 分钟无人接单，已回抢单大厅。`, o.code, o.code));
                cf.hallStatus = 'open';
                cf.hallEnteredAt = enteredAt;
                continue;
            }
            // 6) 自营快递已派出但久未送达交接点 → 回抢单大厅（传信者到店取餐兜底）
            if (cf.hallStatus === 'owned_dispatched' && cf.assignedAt
                && now - new Date(cf.assignedAt).getTime() > deliverMs) {
                const enteredAt = new Date();
                const moved = await this.hall.transitionFrom(ctx, Number(o.id), ['owned_dispatched'], {
                    hallStatus: 'open',
                    hallEnteredAt: enteredAt,
                    deliveryPlan: 'campus_rider',
                    handoverMode: '',
                    deliveryStaffId: null,
                    deliveryStatus: null,
                    assignedAt: null,
                    campusCause: 'owned_deliver_timeout',
                });
                if (!moved)
                    continue;
                core_2.Logger.warn(`Order ${o.code} owned courier timeout → hall`, 'CampusDispatch');
                void ((_y = this.feishu) === null || _y === void 0 ? void 0 : _y.pushEvent('exception', '自营快递送达超时', `订单 ${o.code} 自营快递 ${(_z = cfg.merchantAutoOpenMinutes) !== null && _z !== void 0 ? _z : 15} 分钟未送达交接点，已回抢单大厅。`, o.code, o.code));
                cf.hallStatus = 'open';
                cf.hallEnteredAt = enteredAt;
            }
            // 7) 外部运单轮询对账（防平台回调丢失）：third_party 在途单每 5min 主动查询一次
            if (cf.hallStatus === 'third_party' && cf.thirdPartyDeliveryOrderId && this.thirdParty) {
                const lastSync = cf.thirdPartySyncAt ? new Date(cf.thirdPartySyncAt).getTime() : 0;
                if (now - lastSync > EXTERNAL_SYNC_INTERVAL_MIN * 60000) {
                    cf.thirdPartySyncAt = new Date();
                    await this.hall.updateOrder(ctx, o.id, {
                        customFields: { thirdPartySyncAt: cf.thirdPartySyncAt },
                    });
                    try {
                        const res = await this.thirdParty.syncStatus(ctx, Number(o.id));
                        if (res === null || res === void 0 ? void 0 : res.state) {
                            cf.thirdPartyState = res.state;
                            // 已送达交接点：回调侧已入大厅接力，内存同步防同轮规则误判
                            if (res.state === 'delivered')
                                cf.hallStatus = 'open';
                            core_2.Logger.info(`Order ${o.code} external status synced → ${res.state}`, 'CampusDispatch');
                        }
                    }
                    catch (e) {
                        core_2.Logger.warn(`Order ${o.code} external status sync failed: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusDispatch');
                    }
                }
            }
        }
    }
    /**
     * 超时赔付（P0）：回扫窗口内（默认近 24h，可配）已送达单，实际送达超出承诺时间 + 宽限 → 自动发定向券。
     * 幂等：timeoutCompensatedAt 作闸，已赔单不再扫；发券失败不落痕，下一轮重试。
     * 归因（粗判）：无骑手承接 = platform；接单前耗时 > 骑手在途 = merchant，否则 rider。
     */
    async sweepTimeoutCompensation(ctx, cfg, now) {
        var _a, _b;
        if (!cfg.timeoutCompensationEnabled)
            return;
        // 回扫窗口可配（默认 24h），钳制 1-168 防脏配置把陈年旧单批量补赔
        const windowH = Math.min(168, Math.max(1, Number((_a = cfg.timeoutCompensationWindowHours) !== null && _a !== void 0 ? _a : TIMEOUT_COMPENSATION_WINDOW_H)));
        const since = new Date(now - windowH * 3600000);
        const repo = this.connection.getRepository(ctx, core_2.Order);
        let rows;
        try {
            rows = await repo.createQueryBuilder('order')
                .leftJoin('order.channels', 'channel')
                .where('channel.id = :ch', { ch: ctx.channelId })
                .andWhere('order.customFields.deliveredAt IS NOT NULL')
                .andWhere('order.customFields.deliveredAt >= :since', { since })
                .andWhere('order.customFields.promisedAt IS NOT NULL')
                .andWhere('order.customFields.timeoutCompensatedAt IS NULL')
                .andWhere('order.state != :cancelled', { cancelled: 'Cancelled' })
                // 已全额退款的订单不再赔付（退款单 state 未必是 Cancelled：先退后取消/部分流程）
                .andWhere(`NOT EXISTS (
                    SELECT 1 FROM "payment" p
                    WHERE p."orderId" = "order"."id"
                      AND COALESCE((SELECT SUM(r.total) FROM "refund" r WHERE r."paymentId" = p.id), 0) >= p.amount
                )`)
                .take(TIMEOUT_COMPENSATION_LIMIT)
                .getMany();
        }
        catch (e) {
            core_2.Logger.warn(`timeout compensation query failed: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusDispatch');
            return;
        }
        if (!rows.length)
            return;
        const grace = (_b = cfg.timeoutGraceMinutes) !== null && _b !== void 0 ? _b : 10;
        const templateId = cfg.timeoutCompensationCouponTemplateId;
        // 开关开但未配券模板：不写闸（保留待赔资格），限频告警等运营补配置
        if (!templateId) {
            if (now - this.compensationWarnAt > 10 * 60000) {
                this.compensationWarnAt = now;
                core_2.Logger.warn(`timeout compensation enabled but no coupon template for channel ${cfg.channelId}; ${rows.length} order(s) pending`, 'CampusDispatch');
            }
            return;
        }
        const { coupon } = this.services();
        for (const o of rows) {
            const cf = o.customFields;
            const deliveredMs = new Date(cf.deliveredAt).getTime();
            const promisedMs = new Date(cf.promisedAt).getTime();
            const lateMin = Math.floor((deliveredMs - promisedMs) / 60000);
            if (lateMin <= grace)
                continue;
            // 先抢赔付闸（CAS）：发券与写闸合并为「先认领后发券」，部署重启/并发扫描不会重复发券。
            // 认领失败说明已被其他轮次赔付（或正赔付中），本轮跳过。
            const claimedAt = new Date();
            const claimed = await this.connection.rawConnection.query('UPDATE "order" SET "customFieldsTimeoutcompensatedat" = $1 '
                + 'WHERE id = $2 AND "customFieldsTimeoutcompensatedat" IS NULL RETURNING id', [claimedAt, o.id]);
            const claimedRows = Array.isArray(claimed) && Array.isArray(claimed[0]) ? claimed[0] : claimed;
            if (!Array.isArray(claimedRows) || !claimedRows.length)
                continue;
            const releaseClaim = () => this.connection.rawConnection.query('UPDATE "order" SET "customFieldsTimeoutcompensatedat" = NULL '
                + 'WHERE id = $1 AND "customFieldsTimeoutcompensatedat" = $2', [o.id, claimedAt]).catch(() => undefined);
            let couponId = '';
            if (o.customerId && coupon) {
                try {
                    const ids = await coupon.grantCoupon(ctx, templateId, [o.customerId]);
                    couponId = (ids === null || ids === void 0 ? void 0 : ids[0]) ? String(ids[0]) : '';
                }
                catch (e) {
                    // 发券失败释放闸，下轮重试（模板配错等需人工修配置）
                    await releaseClaim();
                    core_2.Logger.error(`timeout compensation coupon failed for ${o.code}: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusDispatch');
                    continue;
                }
            }
            else {
                await releaseClaim();
                core_2.Logger.warn(`timeout compensation skipped for ${o.code}: coupon service/customer unavailable (channel ${cfg.channelId})`, 'CampusDispatch');
                continue;
            }
            await this.hall.updateOrder(ctx, o.id, {
                customFields: {
                    timeoutCompensationCouponId: couponId,
                    timeoutLateMinutes: lateMin,
                    timeoutAttribution: this.timeoutAttribution(o),
                },
            });
            core_2.Logger.warn(`Order ${o.code} timeout compensation: late ${lateMin}min, attribute=${this.timeoutAttribution(o)}, coupon=${couponId || 'none'}`, 'CampusDispatch');
        }
    }
    /** 超时归因粗判：无骑手承接=platform；接单前耗时更长=merchant，否则=rider */
    timeoutAttribution(order) {
        const cf = order.customFields;
        const deliveredMs = new Date(cf.deliveredAt).getTime();
        if (!cf.assignedAt)
            return 'platform';
        const assignedMs = new Date(cf.assignedAt).getTime();
        const preAssignMs = assignedMs - new Date(order.createdAt).getTime();
        return preAssignMs > deliveredMs - assignedMs ? 'merchant' : 'rider';
    }
    /**
     * T1.5 多单顺路打包（plan 3.3）：同渠道 hallStatus='open' 的 R1/R3 配送单
     * （errand 跑腿单性质不同不打包）按「同楼栋 + 同时段」分桶：
     * - 有 deliverySlotId：slot 相等即同时段；
     * - 即时单：按 hallEnteredAt 聚类，相邻时间差 ≤ ROUTE_IMM_WINDOW_MIN 分钟归一批。
     * 每批 ≥2 单写同一 routeGroupId（批内已有组 id 则复用，保持组稳定不抖动）。
     * 组 id 仅用于整组抢单与展示聚合，不严格维护成员一致性——子单被抢/回厅/退款后
     * 自然脱组（回厅清指派字段，成员过滤以 hallStatus='open' 为准）。
     */
    async packRoutes(ctx, orders) {
        var _a, _b, _c;
        const deliverable = orders.filter(o => {
            const cf = o.customFields;
            return cf.hallStatus === 'open'
                && (cf.fulfillmentRoute === 'R1' || cf.fulfillmentRoute === 'R3');
        });
        if (deliverable.length < 2)
            return;
        // 分桶：buildingId + slotKey
        const buckets = new Map();
        for (const o of deliverable) {
            const cf = o.customFields;
            const key = `${(_a = cf.buildingId) !== null && _a !== void 0 ? _a : ''}|${(_b = cf.deliverySlotId) !== null && _b !== void 0 ? _b : 'imm'}`;
            const arr = (_c = buckets.get(key)) !== null && _c !== void 0 ? _c : [];
            arr.push(o);
            buckets.set(key, arr);
        }
        const groups = [];
        for (const [key, arr] of buckets) {
            if (!key.endsWith('|imm')) {
                if (arr.length >= 2)
                    groups.push(arr);
                continue;
            }
            // 即时单：按入厅时间聚类（升序，相邻差超窗口即断批）
            const entered = (o) => { var _a; return new Date((_a = o.customFields.hallEnteredAt) !== null && _a !== void 0 ? _a : o.createdAt).getTime(); };
            const sorted = [...arr].sort((a, b) => entered(a) - entered(b));
            let cluster = [];
            for (const o of sorted) {
                if (cluster.length
                    && entered(o) - entered(cluster[cluster.length - 1])
                        > DispatchJobService_1.ROUTE_IMM_WINDOW_MIN * 60000) {
                    if (cluster.length >= 2)
                        groups.push(cluster);
                    cluster = [];
                }
                cluster.push(o);
            }
            if (cluster.length >= 2)
                groups.push(cluster);
        }
        for (const g of groups) {
            const existing = g
                .map(o => o.customFields.routeGroupId)
                .find(Boolean);
            const gid = existing !== null && existing !== void 0 ? existing : `rg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const todo = g.filter(o => o.customFields.routeGroupId !== gid);
            if (!todo.length)
                continue;
            // 条件写（P2-9）：仅对仍在大厅且未取消的单写组 id，避免把并发下已抢/已取消单写回 open 口径的聚合组
            const res = await this.connection.rawConnection.query('UPDATE "order" SET "customFieldsRoutegroupid" = $1 '
                + 'WHERE id = ANY($2::int[]) AND "customFieldsHallstatus" = $3 '
                + `AND "state" <> 'Cancelled' RETURNING id`, [gid, todo.map(o => Number(o.id)), 'open']);
            const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
            const hit = new Set((Array.isArray(rows) ? rows : []).map((r) => Number(r.id)));
            for (const o of todo) {
                if (hit.has(Number(o.id)))
                    o.customFields.routeGroupId = gid;
            }
            if (!hit.size)
                continue;
            core_2.Logger.info(`Route packed: ${gid} (${hit.size}/${g.length} orders, buildings=${[...new Set(g.map(o => o.customFields.buildingId))].join('/')})`, 'CampusDispatch');
        }
    }
    /** 订单渠道匹配：channels 关联未加载（无 scalar channelId 可比对）时视为匹配，
     * grabByRider 事务内二次校验 hallStatus 保证幂等，跨渠道重复尝试无害。 */
    orderInChannel(o, cfg) {
        const channels = o.channels;
        return !(channels === null || channels === void 0 ? void 0 : channels.length) || channels.some(c => c.id != null && String(c.id) === String(cfg.channelId));
    }
    /** T4 惰性服务解析（job 定时器首跳早于完整依赖可用，首次退款时才初始化） */
    services() {
        var _a;
        if (!this.orderSvc) {
            this.orderSvc = this.injector.get(core_2.OrderService);
            this.paymentRepo = this.connection.rawConnection.getRepository(core_2.Payment);
            this.couponSvc = this.tryGetCouponService();
        }
        return { order: this.orderSvc, coupon: (_a = this.couponSvc) !== null && _a !== void 0 ? _a : null };
    }
    /** 补偿券服务：coupon-plugin 为可选依赖，动态 require + Injector 解析，
     * 未安装/未启用/解析失败一律返回 null（跳过发券，不阻断退款主流程）。 */
    tryGetCouponService() {
        var _a;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require('@vendure/coupon-plugin');
            if (mod === null || mod === void 0 ? void 0 : mod.CouponService)
                return (_a = this.injector.get(mod.CouponService)) !== null && _a !== void 0 ? _a : null;
        }
        catch (_b) {
            // coupon-plugin 未安装或未启用
        }
        return null;
    }
    /**
     * T4: open 超 autoRefundMinutes 无人接单 → 全额原路退款 + Cancelled + no_rider 对账标记 + 定向补偿券。
     * 本 fork 无 core RefundService，退款走 OrderService.refundOrder/settleRefund（与 after-sales 插件同源）。
     * 失败降级：同样写 campusCause='no_rider' + hallStatus='no_rider_final' 留人工，Logger 留痕，不抛出。
     */
    async refundNoRider(ctx, order, cfg) {
        var _a, _b, _c, _d, _e, _f, _g;
        const mark = () => this.hall.updateOrder(ctx, order.id, {
            customFields: { campusCause: 'no_rider', hallStatus: 'no_rider_final' },
        });
        // 多实例/与商家拒单并发：咨询锁按订单串行化退款，抢不到说明另一路正在处理，本轮跳过
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:refund:${order.id}`;
        try {
            const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.ok))
                return;
            try {
                // 锁内复查：排队等锁期间订单可能已被抢单/商家改派/用户取消，
                // 对已离开 open 的单退款会造成「已派单又退款」；hallEnteredAt 被刷新的单也需重新计时
                const fresh = await this.connection.getRepository(ctx, core_2.Order).findOne({
                    where: { id: order.id },
                });
                const fcf = ((_b = fresh === null || fresh === void 0 ? void 0 : fresh.customFields) !== null && _b !== void 0 ? _b : {});
                if (String((_c = fcf.hallStatus) !== null && _c !== void 0 ? _c : '') !== 'open')
                    return;
                const enteredMs = fcf.hallEnteredAt ? new Date(fcf.hallEnteredAt).getTime() : NaN;
                if (!Number.isNaN(enteredMs)
                    && Date.now() - enteredMs <= ((_d = cfg.autoRefundMinutes) !== null && _d !== void 0 ? _d : 30) * 60000)
                    return;
                const { order: orderSvc, coupon } = this.services();
                const payment = await this.paymentRepo.findOne({
                    where: { order: { id: order.id } },
                    order: { id: 'DESC' },
                });
                if (payment) {
                    // 幂等重试：上一轮 refund 成功但 transition 失败时，payment 已全额退，
                    // 再次 refundOrder 会报 REFUND_AMOUNT_ERROR——先查已退总额，退完则跳过退款只做取消
                    const refunded = await this.connection.rawConnection
                        .getRepository(core_2.Refund)
                        .createQueryBuilder('r')
                        .select('COALESCE(SUM(r.total), 0)', 'sum')
                        .where('r."paymentId" = :pid', { pid: payment.id })
                        .getRawOne();
                    if (Number((_e = refunded === null || refunded === void 0 ? void 0 : refunded.sum) !== null && _e !== void 0 ? _e : 0) < Number(payment.amount)) {
                        const created = await orderSvc.refundOrder(ctx, {
                            paymentId: payment.id,
                            amount: payment.amount,
                            // fork 的 refund 表 shipping/adjustment 列 NOT NULL（payment.service createRefund 透传
                            // input.shipping/input.adjustment），全额退款经 amount 通道，两者必须显式给 0，
                            // 否则 INSERT 报 not-null violation
                            shipping: 0,
                            adjustment: 0,
                            reason: `no_rider auto refund (${order.code})`,
                        });
                        if (!created || created.errorCode) {
                            throw new Error(`refundOrder failed: ${(_f = created === null || created === void 0 ? void 0 : created.errorCode) !== null && _f !== void 0 ? _f : 'no result'}`);
                        }
                        await orderSvc.settleRefund(ctx, { id: created.id });
                    }
                }
                // 用 cancelOrder 而非 transitionToState(Cancelled)：默认 checkAllItemsBeforeCancel 要求
                // 订单行先取消，cancelOrder 内部完成行取消+状态转换；transitionToState 会静默返回 ErrorResult
                const cancelled = await orderSvc.cancelOrder(ctx, {
                    orderId: order.id,
                    reason: `no_rider auto cancel (${order.code})`,
                });
                if (cancelled && cancelled.errorCode) {
                    throw new Error(`cancelOrder failed: ${cancelled.errorCode}`);
                }
                await mark();
                const templateId = cfg.compensationCouponTemplateId;
                if (templateId && order.customerId && coupon) {
                    await coupon.grantCoupon(ctx, templateId, [order.customerId]);
                }
                core_2.Logger.warn(`Order ${order.code} auto-refunded (no rider within ${(_g = cfg.autoRefundMinutes) !== null && _g !== void 0 ? _g : 30}min)`, 'CampusDispatch');
            }
            catch (e) {
                core_2.Logger.error(`T4 refund failed for order ${order.code}: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusDispatch');
                try {
                    await mark();
                }
                catch (e2) {
                    core_2.Logger.error(`T4 fallback mark failed for order ${order.code}: ${e2 === null || e2 === void 0 ? void 0 : e2.message}`, 'CampusDispatch');
                }
            }
        }
        finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            }
            catch (_h) {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }
};
exports.DispatchJobService = DispatchJobService;
/** 即时单（无 deliverySlotId）打包时间窗：入厅时间差 ≤10min 视为顺路 */
DispatchJobService.ROUTE_IMM_WINDOW_MIN = 10;
exports.DispatchJobService = DispatchJobService = DispatchJobService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        hall_grab_service_1.HallGrabService,
        hall_service_1.HallService,
        capacity_service_1.CapacityService,
        rider_credit_service_1.RiderCreditService,
        core_1.ModuleRef,
        third_party_delivery_service_1.ThirdPartyDeliveryService,
        feishu_notify_service_1.FeishuNotifyService])
], DispatchJobService);
//# sourceMappingURL=dispatch-job.service.js.map