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
const core_1 = require("@vendure/core");
const capacity_service_1 = require("./capacity.service");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
/**
 * T3 调度看板 + 手动派单/改派（admin）。
 * board：按渠道拉取 hallStatus 非空订单，分类为大厅/进行中，产出四类告警
 * （stale_open / sla_breach / slot_full / exception）与在线骑手列表。
 * assign：手动强派（复用 grabByRider 事务+悲观锁原语，订单已不在大厅则抛错）。
 * backToHall：改派前置——先回大厅（清骑手指派字段），再由 admin 重新派单。
 */
let DispatchAdminService = class DispatchAdminService {
    constructor(connection, grab, hall, capacity) {
        this.connection = connection;
        this.grab = grab;
        this.hall = hall;
        this.capacity = capacity;
    }
    async board(ctx) {
        var _a, _b, _c, _d, _e, _f, _g;
        const cfg = await this.connection
            .getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId } });
        // 渠道过滤：Order 无标量 channelId，join order.channels（同 core findOneInChannel 模式）。
        // customFields 为嵌入式物理列，QueryBuilder 必须用 embedded 路径 order.customFields.hallStatus。
        const orders = await this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            .getMany();
        const now = Date.now();
        const alerts = [];
        const hallOrders = [];
        const activeOrders = [];
        for (const o of orders) {
            const cf = o.customFields;
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
        return { paused: (_g = cfg === null || cfg === void 0 ? void 0 : cfg.paused) !== null && _g !== void 0 ? _g : false, alerts, hallOrders, activeOrders, ridersOnline };
    }
    /** 手动派单/改派：信任 admin 输入的目标骑手（MVP 不校验资质）。
     * grabByRider 返回 false 表示订单已不在大厅（已被抢/已退款）。 */
    async assign(ctx, orderId, riderCustomerId) {
        const ok = await this.grab.grabByRider(ctx, orderId, { id: riderCustomerId });
        if (!ok)
            throw new core_1.UserInputError('派单失败：订单已不在大厅（已被抢/已退款）');
        return { assigned: true };
    }
    /** 回大厅（改派前置）：清骑手指派字段，hallStatus 复位 open */
    async backToHall(ctx, orderId) {
        const order = await this.connection
            .getRepository(ctx, core_1.Order)
            .findOne({ where: { id: orderId } });
        if (!order)
            throw new core_1.UserInputError('订单不存在');
        await this.hall.backToHall(ctx, orderId);
        return { backToHall: true };
    }
};
exports.DispatchAdminService = DispatchAdminService;
exports.DispatchAdminService = DispatchAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        hall_grab_service_1.HallGrabService,
        hall_service_1.HallService,
        capacity_service_1.CapacityService])
], DispatchAdminService);
//# sourceMappingURL=dispatch-admin.service.js.map