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
exports.DispatchAdminService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const capacity_service_1 = require("./capacity.service");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_notify_service_1 = require("./campus-notify.service");
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
/** 处置完结 push 文案（公众号模板 thing 字段 ≤20 字符，均已核对） */
const EXCEPTION_NOTIFY_TEXT = {
    refund_diff: '异常已处理，差价原路退回',
    coupon: '异常已处理，补偿券已发放',
    refund_all: '订单已全额退款',
    reassign: '平台已重新安排配送',
};
/**
 * T3 调度看板 + 手动派单/改派（admin）。
 * board：按渠道拉取 hallStatus 非空订单，分类为大厅/进行中，产出四类告警
 * （stale_open / sla_breach / slot_full / exception）与在线骑手列表；
 * exception_final（已处置完结）不进墙，单独输出 handledOrders 留痕（plan 3.4）。
 * assign：手动强派（复用 grabByRider 事务+悲观锁原语，订单已不在大厅则抛错）。
 * backToHall：改派前置——先回大厅（清骑手指派字段），再由 admin 重新派单。
 * handleException（plan 3.4）：异常单三选一处置——重派回大厅 / 退差价 / 发补偿券 / 全额退单，
 * 全部动作写 exceptionAction* 记录字段留痕。
 */
let DispatchAdminService = class DispatchAdminService {
    constructor(connection, grab, hall, capacity, moduleRef, notify) {
        this.connection = connection;
        this.grab = grab;
        this.hall = hall;
        this.capacity = capacity;
        this.moduleRef = moduleRef;
        this.notify = notify;
    }
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    get injector() {
        return new core_2.Injector(this.moduleRef);
    }
    async board(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const cfg = await this.connection
            .getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId } });
        // 渠道过滤：Order 无标量 channelId，join order.channels（同 core findOneInChannel 模式）。
        // customFields 为嵌入式物理列，QueryBuilder 必须用 embedded 路径 order.customFields.hallStatus。
        const orders = await this.connection
            .getRepository(ctx, core_2.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            .getMany();
        const now = Date.now();
        const alerts = [];
        const hallOrders = [];
        const activeOrders = [];
        const handled = [];
        for (const o of orders) {
            const cf = o.customFields;
            if (cf.hallStatus === 'exception_final') {
                // 已处置完结（plan 3.4）：不进调度墙，进留痕列表
                handled.push(o);
                continue;
            }
            if (cf.hallStatus === 'scheduled')
                continue; // 预约单未放量，不进调度墙（商家工作台可见，plan 3.1）
            if (cf.hallStatus === 'open') {
                hallOrders.push(o);
                if (cf.campusCause === 'slot_full') {
                    alerts.push({
                        orderId: String(o.id),
                        orderCode: o.code,
                        type: 'slot_full',
                        detail: '预约时段锁位失败（运力满），需人工跟进',
                    });
                }
                const enteredAt = cf.hallEnteredAt;
                if (enteredAt && now - new Date(enteredAt).getTime() > ((_a = cfg === null || cfg === void 0 ? void 0 : cfg.autoAssignMinutes) !== null && _a !== void 0 ? _a : 10) * 60000) {
                    alerts.push({
                        orderId: String(o.id),
                        orderCode: o.code,
                        type: 'stale_open',
                        detail: `大厅滞留超 ${(_b = cfg === null || cfg === void 0 ? void 0 : cfg.autoAssignMinutes) !== null && _b !== void 0 ? _b : 10} 分钟，自动派单未完成`,
                    });
                }
            }
            else if (cf.deliveryStatus === 'in_progress') {
                activeOrders.push(o);
                const at = (_c = cf.assignedAt) !== null && _c !== void 0 ? _c : cf.hallEnteredAt;
                if (at && now - new Date(at).getTime() > ((_d = cfg === null || cfg === void 0 ? void 0 : cfg.inProgressSlaMinutes) !== null && _d !== void 0 ? _d : 45) * 60000) {
                    alerts.push({
                        orderId: String(o.id),
                        orderCode: o.code,
                        type: 'sla_breach',
                        detail: `配送超 SLA（>${(_e = cfg === null || cfg === void 0 ? void 0 : cfg.inProgressSlaMinutes) !== null && _e !== void 0 ? _e : 45} 分钟）`,
                    });
                }
            }
            else if (cf.deliveryStatus === 'exception') {
                alerts.push({
                    orderId: String(o.id),
                    orderCode: o.code,
                    type: 'exception',
                    detail: (_f = cf.exceptionType) !== null && _f !== void 0 ? _f : '骑手上报异常',
                    exceptionNote: (_g = cf.exceptionNote) !== null && _g !== void 0 ? _g : null,
                    exceptionPhotos: (_h = cf.exceptionPhotos) !== null && _h !== void 0 ? _h : null,
                });
            }
            else {
                activeOrders.push(o);
            }
        }
        const riders = await this.capacity.listOnlineRiders(ctx);
        const ridersOnline = riders.map(r => {
            var _a, _b;
            return ({
                customerId: String(r.id),
                realName: (_a = r.customFields.riderRealName) !== null && _a !== void 0 ? _a : '',
                credit: (_b = r.customFields.riderCredit) !== null && _b !== void 0 ? _b : 100,
            });
        });
        const handledOrders = handled
            .sort((a, b) => {
            var _a, _b;
            const ta = new Date((_a = a.customFields.exceptionHandledAt) !== null && _a !== void 0 ? _a : 0).getTime();
            const tb = new Date((_b = b.customFields.exceptionHandledAt) !== null && _b !== void 0 ? _b : 0).getTime();
            return tb - ta;
        })
            .slice(0, 10)
            .map(o => {
            var _a, _b, _c, _d, _e, _f, _g;
            const cf = o.customFields;
            return {
                orderId: String(o.id),
                orderCode: o.code,
                exceptionType: (_a = cf.exceptionType) !== null && _a !== void 0 ? _a : null,
                action: (_b = cf.exceptionAction) !== null && _b !== void 0 ? _b : '',
                compensation: (_c = cf.exceptionCompensation) !== null && _c !== void 0 ? _c : null,
                couponTemplateId: (_d = cf.exceptionCouponTemplateId) !== null && _d !== void 0 ? _d : null,
                note: (_e = cf.exceptionHandledNote) !== null && _e !== void 0 ? _e : null,
                handledAt: (_f = cf.exceptionHandledAt) !== null && _f !== void 0 ? _f : null,
                handledBy: (_g = cf.exceptionHandledBy) !== null && _g !== void 0 ? _g : '',
            };
        });
        return { paused: (_j = cfg === null || cfg === void 0 ? void 0 : cfg.paused) !== null && _j !== void 0 ? _j : false, alerts, hallOrders, activeOrders, ridersOnline, handledOrders };
    }
    /** 手动派单/改派：信任 admin 输入的目标骑手（MVP 不校验资质）。
     * grabByRider 返回 false 表示订单已不在大厅（已被抢/已退款）。 */
    async assign(ctx, orderId, riderCustomerId) {
        const ok = await this.grab.grabByRider(ctx, orderId, { id: riderCustomerId });
        if (!ok)
            throw new core_2.UserInputError('派单失败：订单已不在大厅（已被抢/已退款）');
        return { assigned: true };
    }
    /** 回大厅（改派前置）：清骑手指派字段，hallStatus 复位 open */
    async backToHall(ctx, orderId) {
        const order = await this.connection
            .getRepository(ctx, core_2.Order)
            .findOne({ where: { id: orderId } });
        if (!order)
            throw new core_2.UserInputError('订单不存在');
        await this.hall.backToHall(ctx, orderId);
        return { backToHall: true };
    }
    /** 异常处置（plan 3.4）：仅 deliveryStatus='exception' 的订单可处置。
     * reassign：回大厅（可再抢/强派）；refund_diff：部分退款完结；coupon：发补偿券完结；
     * refund_all：全额退款+取消订单完结。完结单 hallStatus='exception_final' 退出调度墙，
     * 全部动作写 exceptionAction* 记录留痕。 */
    async handleException(ctx, orderId, action, amount, couponTemplateId, note) {
        var _a;
        const order = await this.connection.getRepository(ctx, core_2.Order).findOne({ where: { id: orderId } });
        if (!order)
            throw new core_2.UserInputError('订单不存在');
        if (order.customFields.deliveryStatus !== 'exception') {
            throw new core_2.UserInputError('仅骑手上报异常的订单可处置');
        }
        switch (action) {
            case 'reassign':
                await this.hall.backToHall(ctx, order.id);
                break;
            case 'refund_diff':
                if (!amount || amount <= 0)
                    throw new core_2.UserInputError('赔付金额必须大于 0');
                await this.refundAmount(ctx, order, amount, `exception diff refund (${order.code})`);
                break;
            case 'coupon': {
                if (!couponTemplateId)
                    throw new core_2.UserInputError('请选择补偿券模板');
                const coupon = this.getCouponService();
                if (!coupon)
                    throw new core_2.UserInputError('券服务不可用');
                if (!order.customerId)
                    throw new core_2.UserInputError('订单无客户信息，无法发券');
                await coupon.grantCoupon(ctx, couponTemplateId, [order.customerId]);
                break;
            }
            case 'refund_all':
                await this.refundAllAndCancel(ctx, order);
                break;
            default:
                throw new core_2.UserInputError('未知处置动作');
        }
        const patch = {
            exceptionAction: action,
            exceptionCompensation: action === 'refund_diff' ? amount : null,
            exceptionCouponTemplateId: action === 'coupon' ? String(couponTemplateId) : null,
            exceptionHandledNote: note !== null && note !== void 0 ? note : null,
            exceptionHandledAt: new Date(),
            exceptionHandledBy: String((_a = ctx.activeUserId) !== null && _a !== void 0 ? _a : ''),
        };
        if (action !== 'reassign') {
            patch.hallStatus = 'exception_final';
            if (action === 'refund_all')
                patch.campusCause = 'exception_refund';
        }
        await this.connection.getRepository(ctx, core_2.Order).update(order.id, { customFields: patch });
        core_2.Logger.info(`Order ${order.code} exception handled: ${action}`, 'CampusDispatch');
        // 处置完结 push（fire-and-forget，plan 3.4 补全）：按 action 带动态文案通知下单用户
        this.notify.user(ctx, order.id, 'exceptionHandled', EXCEPTION_NOTIFY_TEXT[action]);
        return { ok: true, action };
    }
    /** 部分退款（fork 无 core RefundService，走 OrderService.refundOrder/settleRefund，与 T4 同源）。
     * refund 表 shipping/adjustment 列 NOT NULL 必须显式传 0；
     * 幂等保护：累计已退 + 本次 ≤ payment.amount，超额抛错。 */
    async refundAmount(ctx, order, amount, reason) {
        var _a, _b;
        const orderSvc = this.getOrderService();
        const payment = await this.connection.rawConnection.getRepository(core_2.Payment).findOne({
            where: { order: { id: order.id } },
            order: { id: 'DESC' },
        });
        if (!payment)
            throw new core_2.UserInputError('订单无支付记录，无法退款');
        const refunded = await this.connection.rawConnection
            .getRepository(core_2.Refund)
            .createQueryBuilder('r')
            .select('COALESCE(SUM(r.total), 0)', 'sum')
            .where('r."paymentId" = :pid', { pid: payment.id })
            .getRawOne();
        if (Number((_a = refunded === null || refunded === void 0 ? void 0 : refunded.sum) !== null && _a !== void 0 ? _a : 0) + amount > Number(payment.amount)) {
            throw new core_2.UserInputError('退款金额超过可退余额（订单可能已全额退款）');
        }
        const created = await orderSvc.refundOrder(ctx, {
            paymentId: payment.id,
            amount,
            shipping: 0,
            adjustment: 0,
            reason,
        });
        if (!created || created.errorCode) {
            throw new Error(`refundOrder failed: ${(_b = created === null || created === void 0 ? void 0 : created.errorCode) !== null && _b !== void 0 ? _b : 'no result'}`);
        }
        await orderSvc.settleRefund(ctx, { id: created.id });
    }
    /** 全额退单：退剩余未退部分 + cancelOrder（行取消+状态转换，同 T4） */
    async refundAllAndCancel(ctx, order) {
        var _a;
        const orderSvc = this.getOrderService();
        const payment = await this.connection.rawConnection.getRepository(core_2.Payment).findOne({
            where: { order: { id: order.id } },
            order: { id: 'DESC' },
        });
        if (payment) {
            const refunded = await this.connection.rawConnection
                .getRepository(core_2.Refund)
                .createQueryBuilder('r')
                .select('COALESCE(SUM(r.total), 0)', 'sum')
                .where('r."paymentId" = :pid', { pid: payment.id })
                .getRawOne();
            const rest = Number(payment.amount) - Number((_a = refunded === null || refunded === void 0 ? void 0 : refunded.sum) !== null && _a !== void 0 ? _a : 0);
            if (rest > 0) {
                await this.refundAmount(ctx, order, rest, `exception full refund (${order.code})`);
            }
        }
        const cancelled = await orderSvc.cancelOrder(ctx, {
            orderId: order.id,
            reason: `exception full refund cancel (${order.code})`,
        });
        if (cancelled && cancelled.errorCode) {
            throw new Error(`cancelOrder failed: ${cancelled.errorCode}`);
        }
    }
    getOrderService() {
        if (!this.orderSvc)
            this.orderSvc = this.injector.get(core_2.OrderService);
        return this.orderSvc;
    }
    /** 补偿券服务：coupon-plugin 为可选依赖，动态 require + Injector 解析（同 dispatch-job），
     * 未安装/未启用/解析失败返回 null。 */
    getCouponService() {
        var _a, _b;
        if (this.couponSvc !== undefined)
            return (_a = this.couponSvc) !== null && _a !== void 0 ? _a : null;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require('@vendure/coupon-plugin');
            this.couponSvc = (mod === null || mod === void 0 ? void 0 : mod.CouponService) ? this.injector.get(mod.CouponService) : null;
        }
        catch (_c) {
            this.couponSvc = null;
        }
        return (_b = this.couponSvc) !== null && _b !== void 0 ? _b : null;
    }
};
exports.DispatchAdminService = DispatchAdminService;
exports.DispatchAdminService = DispatchAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        hall_grab_service_1.HallGrabService,
        hall_service_1.HallService,
        capacity_service_1.CapacityService,
        core_1.ModuleRef,
        campus_notify_service_1.CampusNotifyService])
], DispatchAdminService);
//# sourceMappingURL=dispatch-admin.service.js.map