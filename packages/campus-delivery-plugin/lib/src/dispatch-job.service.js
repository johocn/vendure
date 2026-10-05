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
exports.DispatchJobService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const capacity_service_1 = require("./capacity.service");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
const rider_credit_service_1 = require("./rider-credit.service");
const NOT_PICKED_TIMEOUT_MIN = 15;
let DispatchJobService = class DispatchJobService {
    constructor(connection, grab, hall, capacity, credit, moduleRef) {
        this.connection = connection;
        this.grab = grab;
        this.hall = hall;
        this.capacity = capacity;
        this.credit = credit;
        this.moduleRef = moduleRef;
        this.timer = null;
        this.running = false;
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
                await this.scan(this.ctxForChannel(cfg.channelId));
            }
        }
        finally {
            this.running = false;
        }
    }
    ctxForChannel(channelId) {
        return new core_2.RequestContext({
            apiType: 'admin',
            channel: new core_2.Channel({ id: channelId }),
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
        const repo = this.connection.getRepository(ctx, core_2.Order);
        const orders = await repo.createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere("order.customFields.hallStatus IN ('open', 'grabbed')")
            .getMany();
        const now = Date.now();
        // 1) assigned 超 15min 未取货 → 回大厅 + 扣分
        for (const o of orders) {
            const cf = o.customFields;
            if (cf.hallStatus === 'grabbed' && cf.deliveryStatus === 'assigned' && cf.assignedAt) {
                if (now - new Date(cf.assignedAt).getTime() > NOT_PICKED_TIMEOUT_MIN * 60000) {
                    await this.hall.backToHall(ctx, o.id);
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
                const stale = orders.filter(o => {
                    var _a;
                    const cf = o.customFields;
                    return cf.hallStatus === 'open' && this.orderInChannel(o, cfg) && cf.hallEnteredAt
                        && now - new Date(cf.hallEnteredAt).getTime() > ((_a = cfg.autoAssignMinutes) !== null && _a !== void 0 ? _a : 10) * 60000;
                }).sort((a, b) => new Date(a.customFields.hallEnteredAt).getTime()
                    - new Date(b.customFields.hallEnteredAt).getTime());
                for (const o of stale) {
                    const ok = await this.grab.grabByRider(ctx, o.id, eligible[0]);
                    if (ok)
                        core_2.Logger.warn(`Order ${o.code} auto-assigned to rider ${eligible[0].id} (T2)`, 'CampusDispatch');
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
        var _a, _b;
        const mark = () => this.hall.updateOrder(ctx, order.id, {
            customFields: { campusCause: 'no_rider', hallStatus: 'no_rider_final' },
        });
        try {
            const { order: orderSvc, coupon } = this.services();
            const payment = await this.paymentRepo.findOne({
                where: { order: { id: order.id } },
                order: { id: 'DESC' },
            });
            if (payment) {
                const created = await orderSvc.refundOrder(ctx, {
                    paymentId: payment.id,
                    amount: payment.amount,
                    reason: `no_rider auto refund (${order.code})`,
                });
                if (!created || created.errorCode) {
                    throw new Error(`refundOrder failed: ${(_a = created === null || created === void 0 ? void 0 : created.errorCode) !== null && _a !== void 0 ? _a : 'no result'}`);
                }
                await orderSvc.settleRefund(ctx, { id: created.id });
            }
            await orderSvc.transitionToState(ctx, order.id, 'Cancelled');
            await mark();
            const templateId = cfg.compensationCouponTemplateId;
            if (templateId && order.customerId && coupon) {
                await coupon.grantCoupon(ctx, templateId, [order.customerId]);
            }
            core_2.Logger.warn(`Order ${order.code} auto-refunded (no rider within ${(_b = cfg.autoRefundMinutes) !== null && _b !== void 0 ? _b : 30}min)`, 'CampusDispatch');
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
};
exports.DispatchJobService = DispatchJobService;
exports.DispatchJobService = DispatchJobService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        hall_grab_service_1.HallGrabService,
        hall_service_1.HallService,
        capacity_service_1.CapacityService,
        rider_credit_service_1.RiderCreditService,
        core_1.ModuleRef])
], DispatchJobService);
//# sourceMappingURL=dispatch-job.service.js.map