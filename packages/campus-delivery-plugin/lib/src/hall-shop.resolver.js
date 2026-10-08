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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HallShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const campus_config_service_1 = require("./campus-config.service");
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
const rider_earning_entity_1 = require("./rider-earning.entity");
const rider_credit_service_1 = require("./rider-credit.service");
const rider_service_1 = require("./rider.service");
let HallShopResolver = class HallShopResolver {
    constructor(grab, config, riderService, connection, hall, credit) {
        this.grab = grab;
        this.config = config;
        this.riderService = riderService;
        this.connection = connection;
        this.hall = hall;
        this.credit = credit;
    }
    /** grab 失败（已被抢/抢自己的/非骑手）由 service 抛 UserInputError/ForbiddenError，Vendure 转 GraphQL 错误。 */
    async campusGrabOrder(ctx, orderId) {
        return this.grab.grab(ctx, orderId);
    }
    /** 拒单：仅限被指派且未取货的骑手；订单回大厅 + 骑手扣分。 */
    async campusRejectAssignment(ctx, orderId) {
        return this.rejectAssignment(ctx, orderId);
    }
    async rejectAssignment(ctx, orderId) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({ where: { id: orderId } });
        const cf = order === null || order === void 0 ? void 0 : order.customFields;
        if (!order || cf.deliveryStaffId !== String(rider.id) || cf.deliveryStatus !== 'assigned') {
            throw new core_1.UserInputError('该订单未指派给您或已取货，不能拒单');
        }
        await this.hall.backToHall(ctx, order.id);
        await this.credit.adjust(ctx, rider.id, rider_credit_service_1.CREDIT_REJECT, 'reject_assign', order.id);
        return { backToHall: true };
    }
    async campusHall(ctx) {
        // F4 收敛信息暴露面：大厅仅对已认证骑手开放（防匿名拉取全渠道单号/金额/楼栋）
        await this.riderService.assertApprovedRider(ctx);
        return this.grab.hall(ctx);
    }
    /** 公开只读：选时段前预检余量 */
    async campusShopSlots(ctx) {
        return this.config.slotsForShop(ctx);
    }
    async campusSetDeliveryTarget(ctx, zoneId, buildingId, route, slotId) {
        return this.config.setDeliveryTarget(ctx, Number(zoneId), Number(buildingId), route, slotId);
    }
    async myRiderEarnings(ctx, skip, take) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        return this.connection
            .getRepository(ctx, rider_earning_entity_1.RiderEarning)
            .createQueryBuilder('earning')
            .where('earning.riderCustomerId = :id', { id: rider.id })
            .orderBy('earning.createdAt', 'DESC')
            .skip(skip !== null && skip !== void 0 ? skip : 0)
            .take(take !== null && take !== void 0 ? take : 20)
            .getMany();
    }
};
exports.HallShopResolver = HallShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], HallShopResolver.prototype, "campusGrabOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], HallShopResolver.prototype, "campusRejectAssignment", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], HallShopResolver.prototype, "campusHall", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], HallShopResolver.prototype, "campusShopSlots", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('zoneId')),
    __param(2, (0, graphql_1.Args)('buildingId')),
    __param(3, (0, graphql_1.Args)({ name: 'route', type: () => String, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'slotId', type: () => graphql_1.Int, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, String, Number]),
    __metadata("design:returntype", Promise)
], HallShopResolver.prototype, "campusSetDeliveryTarget", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('skip', { nullable: true })),
    __param(2, (0, graphql_1.Args)('take', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], HallShopResolver.prototype, "myRiderEarnings", null);
exports.HallShopResolver = HallShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [hall_grab_service_1.HallGrabService,
        campus_config_service_1.CampusConfigService,
        rider_service_1.RiderService,
        core_1.TransactionalConnection,
        hall_service_1.HallService,
        rider_credit_service_1.RiderCreditService])
], HallShopResolver);
//# sourceMappingURL=hall-shop.resolver.js.map