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
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const capacity_service_1 = require("./capacity.service");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
const rider_credit_service_1 = require("./rider-credit.service");
const NOT_PICKED_TIMEOUT_MIN = 15;
let DispatchJobService = class DispatchJobService {
    constructor(connection, grab, hall, capacity, credit) {
        this.connection = connection;
        this.grab = grab;
        this.hall = hall;
        this.capacity = capacity;
        this.credit = credit;
        this.timer = null;
        this.running = false;
    }
    start(intervalMs = 60000) {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            this.tick().catch(e => core_1.Logger.error(`dispatch tick: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusDispatch'));
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
        return new core_1.RequestContext({
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
                    core_1.Logger.warn(`Order ${o.code} reassigned (rider ${cf.deliveryStaffId} not picked in ${NOT_PICKED_TIMEOUT_MIN}min)`, 'CampusDispatch');
                }
            }
        }
        // 2) T2 强派
        const cfg = await this.connection
            .getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId } });
        if (!cfg)
            return;
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
        if (!eligible.length)
            return;
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
                core_1.Logger.warn(`Order ${o.code} auto-assigned to rider ${eligible[0].id} (T2)`, 'CampusDispatch');
            // grabByRider 内部乐观锁失败（已被抢/已退款）返回 false，跳过即可
        }
    }
    /** 订单渠道匹配：channels 关联未加载（无 scalar channelId 可比对）时视为匹配，
     * grabByRider 事务内二次校验 hallStatus 保证幂等，跨渠道重复尝试无害。 */
    orderInChannel(o, cfg) {
        const channels = o.channels;
        return !(channels === null || channels === void 0 ? void 0 : channels.length) || channels.some(c => c.id != null && String(c.id) === String(cfg.channelId));
    }
};
exports.DispatchJobService = DispatchJobService;
exports.DispatchJobService = DispatchJobService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        hall_grab_service_1.HallGrabService,
        hall_service_1.HallService,
        capacity_service_1.CapacityService,
        rider_credit_service_1.RiderCreditService])
], DispatchJobService);
//# sourceMappingURL=dispatch-job.service.js.map