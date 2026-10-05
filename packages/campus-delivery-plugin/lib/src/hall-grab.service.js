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
exports.HallGrabService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const rider_service_1 = require("./rider.service");
let HallGrabService = class HallGrabService {
    constructor(connection, riderService) {
        this.connection = connection;
        this.riderService = riderService;
    }
    /** 抢单：事务 + pessimistic_write，hallStatus 非 open 即抛「手慢了」。
     * 同时写 delivery customFields（deliveryStaffId/deliveryStatus=assigned），复用其任务体系。
     * 事务内查询与更新均使用事务 em，保证读写同一事务。
     * 注：lock.tables 指定 "order" 表，避免 FOR UPDATE 作用于 customer 外连接的可空侧（PG 报错）。 */
    async grab(ctx, orderId) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        return this.connection.rawConnection.transaction(async (em) => {
            var _a;
            const order = await em.getRepository(core_1.Order).findOne({
                where: { id: orderId },
                relations: ['customer'],
                lock: { mode: 'pessimistic_write', tables: ['order'] },
            });
            const cf = order === null || order === void 0 ? void 0 : order.customFields;
            if (!order || (cf === null || cf === void 0 ? void 0 : cf.hallStatus) !== 'open')
                throw new core_1.UserInputError('手慢了，该订单已被抢');
            if (((_a = order.customer) === null || _a === void 0 ? void 0 : _a.id) === rider.id)
                throw new core_1.UserInputError('不能抢自己的订单');
            await em.getRepository(core_1.Order).update(order.id, {
                customFields: {
                    hallStatus: 'grabbed',
                    deliveryStaffId: String(rider.id),
                    deliveryStatus: 'assigned',
                    assignedAt: new Date(),
                },
            });
            return em.getRepository(core_1.Order).findOneByOrFail({ id: orderId });
        });
    }
    /**
     * 大厅列表：当前渠道 open 状态订单（含跑腿单），按小费/入厅时间排序。
     * customFields 在 Vendure 中注册为嵌入式真实物理列（registerCustomEntityFields），
     * 故采用扁平列取法 order.hallStatus / order.tip（TypeORM 会改写为 "order"."hallStatus" 等）。
     * 备选：若部署为 JSON 列，则改用
     *   where: "order.customFields ->> 'hallStatus' = :s"
     *   orderBy: "order.customFields ->> 'tip'" DESC
     * PG 索引建议：JSON 列取法补
     *   CREATE INDEX IF NOT EXISTS idx_order_hall_status ON "order" ((customFields->>'hallStatus'))；
     * 扁平列取法则为 ON "order" ("hallStatus")。
     * 渠道过滤：Order 无标量 channelId 列，channels 为多对多关联（同 core findOneInChannel 模式），
     * 故 join order.channels 过滤 channel.id = ctx.channelId。
     */
    async hall(ctx) {
        return this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('order.hallStatus = :s', { s: 'open' })
            .orderBy('order.tip', 'DESC')
            .addOrderBy('order.createdAt', 'ASC')
            .getMany();
    }
};
exports.HallGrabService = HallGrabService;
exports.HallGrabService = HallGrabService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, rider_service_1.RiderService])
], HallGrabService);
//# sourceMappingURL=hall-grab.service.js.map