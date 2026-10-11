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
exports.HotelBookingShopResolver = void 0;
// 酒店预订单 Shop API（P3 Task 11 / P4 Task 14）：
// - C 端「我的预订」（订单详情预订卡，Task 12）数据源
// - Task 14：取消报价 + 顾客自助取消
// 归属隔离：按当前登录顾客名下订单过滤，未登录/无顾客返回空（绝不返回他人预订）
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const booking_service_1 = require("./booking.service");
const booking_entity_1 = require("./booking.entity");
let HotelBookingShopResolver = class HotelBookingShopResolver {
    constructor(bookingService, customerService, conn) {
        this.bookingService = bookingService;
        this.customerService = customerService;
        this.conn = conn;
    }
    /** 当前顾客名下订单 id 集合（归属隔离唯一口径；未登录返回 null） */
    async ownOrderIds(ctx) {
        if (!ctx.activeUserId)
            return null;
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            return null;
        const orderRows = await this.conn
            .getRepository(ctx, core_2.Order)
            .find({ where: { customer: { id: customer.id } }, select: ['id'] });
        return orderRows.map(o => Number(o.id));
    }
    /** 取预订并校验归属，违规一律 UserInputError（不泄漏存在性） */
    async loadOwnedBooking(ctx, id) {
        const ownIds = await this.ownOrderIds(ctx);
        if (!ownIds)
            throw new core_1.UserInputError('请先登录');
        const detail = await this.conn.getRepository(ctx, booking_entity_1.HotelBooking).findOne({
            where: { id: Number(id) },
        });
        if (!detail || !ownIds.includes(Number(detail.orderId))) {
            throw new core_1.UserInputError('预订单不存在');
        }
        return detail;
    }
    async myHotelBookings(ctx, status) {
        const orderIds = await this.ownOrderIds(ctx);
        if (!orderIds)
            return [];
        return this.bookingService.listForCustomer(ctx, orderIds, status);
    }
    /** 取消报价（取消按钮二次确认弹层数据源） */
    async hotelBookingCancelQuote(ctx, id) {
        var _a;
        await this.loadOwnedBooking(ctx, id);
        try {
            const result = await this.bookingService.quoteCancel(ctx, id);
            return {
                bookingId: result.booking.id,
                mode: result.quote.mode,
                free: result.quote.free,
                cancellable: result.quote.cancellable,
                refundCent: result.quote.refundCent,
                feeCent: result.quote.feeCent,
                totalCent: result.booking.totalCent,
                paidCent: result.paidCent,
                firstNightFeeCent: result.firstNightFeeCent,
                deadline: result.quote.deadline,
            };
        }
        catch (e) {
            throw new core_1.UserInputError((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : 'CANCEL_QUOTE_FAILED');
        }
    }
    /** 顾客自助取消（退款链路在 service；partial 返回时预订仍为 confirmed，等售后审批收口） */
    async cancelMyHotelBooking(ctx, id, reason) {
        var _a;
        await this.loadOwnedBooking(ctx, id);
        try {
            return await this.bookingService.cancelByCustomer(ctx, id, reason);
        }
        catch (e) {
            throw new core_1.UserInputError((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : 'CANCEL_FAILED');
        }
    }
};
exports.HotelBookingShopResolver = HotelBookingShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], HotelBookingShopResolver.prototype, "myHotelBookings", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], HotelBookingShopResolver.prototype, "hotelBookingCancelQuote", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('reason', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], HotelBookingShopResolver.prototype, "cancelMyHotelBooking", null);
exports.HotelBookingShopResolver = HotelBookingShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [booking_service_1.HotelBookingService,
        core_1.CustomerService,
        core_1.TransactionalConnection])
], HotelBookingShopResolver);
//# sourceMappingURL=booking-shop.resolver.js.map