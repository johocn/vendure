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
var HallService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HallService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const wechat_subscribe_message_plugin_1 = require("@vendure/wechat-subscribe-message-plugin");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const capacity_service_1 = require("./capacity.service");
const slot_lock_service_1 = require("./slot-lock.service");
const route_matrix_1 = require("./route-matrix");
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
let HallService = HallService_1 = class HallService {
    constructor(connection, slotLock, moduleRef, capacity) {
        this.connection = connection;
        this.slotLock = slotLock;
        this.moduleRef = moduleRef;
        this.capacity = capacity;
    }
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    get injector() {
        return new core_2.Injector(this.moduleRef);
    }
    async onOrderPlaced(ctx, order) {
        var _a, _b, _c, _d, _e, _f, _g;
        const cf = order.customFields;
        const isErrand = cf.orderKind === 'errand';
        const route = String((_a = cf.fulfillmentRoute) !== null && _a !== void 0 ? _a : (isErrand ? 'R5' : ''));
        // 需要派单的只有 R1/R2/R3；R4 到店自取、R5 跑腿走原链路
        if (!isErrand && !['R1', 'R2', 'R3'].includes(route))
            return;
        const cfg = await this.connection
            .getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId } });
        const plan = (0, route_matrix_1.resolveRoutePlan)(route, cfg !== null && cfg !== void 0 ? cfg : {});
        // R1/R2 恒接力，必须有校园交接点；缺失则降级为传信者到店取餐直送（不能让订单卡住）
        const needsPoint = route === 'R1' || route === 'R2';
        const point = needsPoint ? (0, route_matrix_1.resolveHandoverPoint)(route, cfg !== null && cfg !== void 0 ? cfg : {}) : null;
        const degrade = needsPoint && !point;
        // 履约快照：下单时冻结，后续配置变更不影响在途单
        const snapshot = Object.assign({ deliveryPlan: degrade ? 'campus_rider' : ((_b = plan === null || plan === void 0 ? void 0 : plan.leg1) !== null && _b !== void 0 ? _b : 'campus_rider'), handoverMode: degrade ? '' : ((_c = plan === null || plan === void 0 ? void 0 : plan.handover) !== null && _c !== void 0 ? _c : ''), thirdPartyProvider: '', handoverPointName: (_d = point === null || point === void 0 ? void 0 : point.name) !== null && _d !== void 0 ? _d : '', handoverPointAddress: (_e = point === null || point === void 0 ? void 0 : point.address) !== null && _e !== void 0 ? _e : '', handoverPointLat: (_f = point === null || point === void 0 ? void 0 : point.lat) !== null && _f !== void 0 ? _f : null, handoverPointLng: (_g = point === null || point === void 0 ? void 0 : point.lng) !== null && _g !== void 0 ? _g : null }, (degrade ? { campusCause: 'no_handover_point' } : {}));
        const locked = await this.slotLock.lock(ctx, order);
        const scheduledAt = cf.scheduledFor ? new Date(cf.scheduledFor).getTime() : NaN;
        const deferred = !Number.isNaN(scheduledAt) && scheduledAt - Date.now() > HallService_1.SCHEDULE_RELEASE_MIN * 60000;
        const update = (patch) => this.connection.getRepository(ctx, core_2.Order).update(order.id, {
            customFields: Object.assign(Object.assign(Object.assign({}, snapshot), (locked || snapshot.campusCause ? {} : { campusCause: 'slot_full' })), patch),
        });
        // R1：商户/自营快递先完成第一段（送到校园交接点），出餐后由商家工作台分流
        if (route === 'R1' && !degrade) {
            if (deferred) {
                await update({ hallStatus: 'scheduled' });
                return;
            }
            await update({ hallStatus: 'pending_merchant' });
            core_2.Logger.info(`Order ${order.code} awaiting merchant (R1/${snapshot.deliveryPlan})`, 'CampusHall');
            return;
        }
        // R2：固定外部快递，等运营中心选择提供方推送
        if (route === 'R2' && !degrade) {
            await update({ hallStatus: deferred ? 'scheduled' : 'pending_dispatch' });
            core_2.Logger.info(`Order ${order.code} awaiting external push (R2)`, 'CampusHall');
            return;
        }
        // R3：一段到底，按第一段进入对应池
        const leg1 = String(snapshot.deliveryPlan);
        if (deferred) {
            await update({ hallStatus: 'scheduled' });
            return;
        }
        if (leg1 === 'external_courier') {
            await update({ hallStatus: 'pending_dispatch' });
            core_2.Logger.info(`Order ${order.code} awaiting external push (R3)`, 'CampusHall');
            return;
        }
        if (leg1 === 'owned') {
            await update({ hallStatus: 'owned_pool' });
            core_2.Logger.info(`Order ${order.code} in owned pool (R3)`, 'CampusHall');
            return;
        }
        if (cfg === null || cfg === void 0 ? void 0 : cfg.merchantConfirmEnabled) {
            await update({ hallStatus: 'pending_merchant' });
            return;
        }
        await update({ hallStatus: 'open', hallEnteredAt: new Date() });
        core_2.Logger.info(`Order ${order.code} entered hall (${route}, slotLocked=${locked})`, 'CampusHall');
        this.notifyRiders(ctx, order);
    }
    /** 预约单放量（调度 job 调用，plan 3.1）：按路由/快照分流 */
    async releaseScheduled(ctx, order, cfg) {
        var _a;
        const cf = order.customFields;
        const route = String((_a = cf.fulfillmentRoute) !== null && _a !== void 0 ? _a : '');
        let next = 'open';
        if (route === 'R1')
            next = 'pending_merchant';
        else if (route === 'R2' || cf.deliveryPlan === 'external_courier')
            next = 'pending_dispatch';
        else if (cf.deliveryPlan === 'owned')
            next = 'owned_pool';
        else if (cfg === null || cfg === void 0 ? void 0 : cfg.merchantConfirmEnabled)
            next = 'pending_merchant';
        await this.connection.getRepository(ctx, core_2.Order).update(order.id, {
            customFields: next === 'open'
                ? { hallStatus: next, hallEnteredAt: new Date() }
                : { hallStatus: next },
        });
        core_2.Logger.info(`Order ${order.code} scheduled → ${next}`, 'CampusHall');
        if (next === 'open')
            this.notifyRiders(ctx, order);
    }
    /** 第一段交接完成：订单进校园抢单大厅（R1/R2 接力上楼） */
    async enterHallForHandover(ctx, orderId, cause) {
        const order = await this.connection.getRepository(ctx, core_2.Order).findOne({
            where: { id: orderId },
            relations: ['channels'],
        });
        if (!order) {
            core_2.Logger.warn(`enterHallForHandover 订单不存在 #${orderId}`, 'CampusHall');
            return;
        }
        await this.updateOrder(ctx, orderId, {
            customFields: {
                hallStatus: 'open',
                hallEnteredAt: new Date(),
                deliveryStatus: 'pending',
                assignedAt: null,
                deliveryStaffId: null,
                campusCause: cause,
            },
        });
        this.notifyRiders(ctx, order);
        core_2.Logger.info(`订单 ${order.code} 交接完成进入大厅 (${cause})`, 'CampusHall');
    }
    /** 回大厅：清骑手指派字段，hallStatus 复位 open（拒单/超时改派共用） */
    async backToHall(ctx, orderId) {
        await this.connection.getRepository(ctx, core_2.Order).update(orderId, {
            customFields: { hallStatus: 'open', deliveryStaffId: null, deliveryStatus: null, assignedAt: null },
        });
    }
    /** 取消脱厅（3.3 冒烟实测缺陷）：订单取消终态时清 hallStatus，使其退出大厅/打包扫描/整组抢单/调度台。
     * 先读 DB 当前值防 T4 mark() 竞态覆盖（no_rider_final 不碰）；grabbed 单连带清骑手指派字段。 */
    async exitHall(ctx, order) {
        var _a;
        const cur = await this.connection.getRepository(ctx, core_2.Order).findOne({ where: { id: order.id } });
        const hs = (_a = cur === null || cur === void 0 ? void 0 : cur.customFields) === null || _a === void 0 ? void 0 : _a.hallStatus;
        const active = ['open', 'pending_merchant', 'accepted', 'scheduled', 'grabbed', 'third_party', 'merchant_delivering', 'owned_pool', 'owned_dispatched', 'pending_dispatch'];
        if (!hs || !active.includes(hs))
            return;
        await this.connection.getRepository(ctx, core_2.Order).update(order.id, {
            customFields: Object.assign({ hallStatus: 'cancelled' }, (hs === 'grabbed' ? { deliveryStaffId: null, deliveryStatus: null, assignedAt: null } : {})),
        });
        core_2.Logger.info(`Order ${order.code} exited hall (${hs} → cancelled)`, 'CampusHall');
    }
    /** 通用订单更新（T4 退款终态标记等复用） */
    updateOrder(ctx, orderId, patch) {
        return this.connection.getRepository(ctx, core_2.Order).update(orderId, patch);
    }
    /** T0: 新单入厅即提醒在线骑手（订阅消息），失败只记日志不阻塞入厅。
     * 模板 ID 复用渠道 orderShippedTemplateId（wechat 插件未定义 campus 专用模板字段），
     * 未配置则跳过；逐骑手发送，单个失败不影响其余骑手。 */
    notifyRiders(ctx, order) {
        void (async () => {
            var _a, _b, _c;
            try {
                const templateId = ((_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {}).orderShippedTemplateId;
                if (!templateId) {
                    core_2.Logger.debug(`Channel ${ctx.channelId} has no orderShippedTemplateId, skip rider notify`, 'CampusHall');
                    return;
                }
                const msg = this.injector.get(wechat_subscribe_message_plugin_1.SubscribeMessageService);
                const riders = await this.capacity.listOnlineRiders(ctx);
                for (const r of riders) {
                    try {
                        await msg.sendCustomMessage(ctx, r.id, templateId, {
                            orderCode: { value: order.code },
                            zone: { value: (_c = order.customFields.campusZone) !== null && _c !== void 0 ? _c : '' },
                        });
                    }
                    catch (e) {
                        core_2.Logger.warn(`rider notify failed (customer ${r.id}): ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusHall');
                    }
                }
            }
            catch (e) {
                core_2.Logger.warn(`rider notify failed: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusHall');
            }
        })();
    }
};
exports.HallService = HallService;
/** 预约单放量窗口：scheduledFor 前 30min 才进入商家确认/抢单大厅（plan 3.1） */
HallService.SCHEDULE_RELEASE_MIN = 30;
exports.HallService = HallService = HallService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        slot_lock_service_1.SlotLockService,
        core_1.ModuleRef,
        capacity_service_1.CapacityService])
], HallService);
//# sourceMappingURL=hall.service.js.map