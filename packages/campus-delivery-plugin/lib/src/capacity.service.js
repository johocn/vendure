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
exports.CapacityService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const rider_service_1 = require("./rider.service");
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
let CapacityService = class CapacityService {
    constructor(connection, riderService) {
        this.connection = connection;
        this.riderService = riderService;
    }
    /** 在线骑手：approved 且 5min 内有心跳。运力池当前不分分区（MVP），后续在此加 where。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径 customer.customFields.riderStatus
     * （与 rider.service.ts listApplications 写法一致）。内存侧再校验一次 riderStatus 双保险。 */
    async listOnlineRiders(ctx) {
        const customers = await this.connection
            .getRepository(ctx, core_1.Customer)
            .createQueryBuilder('customer')
            .where('customer.customFields.riderStatus = :status', { status: 'approved' })
            .andWhere('customer.customFields.riderOnlineAt IS NOT NULL')
            .getMany();
        const now = Date.now();
        return customers.filter(c => {
            var _a;
            const cf = ((_a = c.customFields) !== null && _a !== void 0 ? _a : {});
            const at = cf.riderOnlineAt;
            return cf.riderStatus === 'approved' && at && now - new Date(at).getTime() <= ONLINE_WINDOW_MS;
        });
    }
    /** T0 预检：C 端下单前提示「运力紧张」 */
    async capacityCheck(ctx) {
        var _a;
        const cfg = await this.connection
            .getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId } });
        const riders = await this.listOnlineRiders(ctx);
        return { paused: (_a = cfg === null || cfg === void 0 ? void 0 : cfg.paused) !== null && _a !== void 0 ? _a : false, ridersOnline: riders.length };
    }
    /** 心跳（带骑手资格校验的封装）：骑手端 30s 定时调 */
    async heartbeat(ctx) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        await this.connection.getRepository(ctx, core_1.Customer).update(rider.id, {
            customFields: { riderOnlineAt: new Date() },
        });
        return { online: true };
    }
};
exports.CapacityService = CapacityService;
exports.CapacityService = CapacityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        rider_service_1.RiderService])
], CapacityService);
//# sourceMappingURL=capacity.service.js.map