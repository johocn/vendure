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
    /** 改期报价（改期弹层：规则拦截/逐晚房态/新旧价差；不落库） */
    async hotelBookingRescheduleQuote(ctx, id, checkIn, checkOut) {
        var _a, _b, _c;
        await this.loadOwnedBooking(ctx, id);
        try {
            const r = await this.bookingService.quoteReschedule(ctx, id, {
                checkIn,
                checkOut,
            });
            return {
                bookingId: r.booking.id,
                eligible: r.eligible,
                reason: (_a = r.reason) !== null && _a !== void 0 ? _a : null,
                message: (_b = r.message) !== null && _b !== void 0 ? _b : null,
                oldCheckIn: r.oldCheckIn,
                oldCheckOut: r.oldCheckOut,
                newCheckIn: r.newCheckIn,
                newCheckOut: r.newCheckOut,
                nights: r.nights,
                oldTotalCent: r.oldTotalCent,
                newTotalCent: r.newTotalCent,
                diffCent: r.diffCent,
                refundCent: r.refundCent,
                supplementCent: r.supplementCent,
                availability: r.availability,
            };
        }
        catch (e) {
            throw new core_1.UserInputError((_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : 'RESCHEDULE_QUOTE_FAILED');
        }
    }
    /**
     * 顾客提交改期（归属隔离）：
     * applied=true 改期完成（等价/退差/补差即时到账）；applied=false 返回补差支付参数（paymentState/paymentPublic），
     * 支付成功后由服务端事件自动收口，前端轮询 myHotelBookings 即可。
     */
    async rescheduleMyHotelBooking(ctx, id, checkIn, checkOut, paymentMethod) {
        var _a;
        await this.loadOwnedBooking(ctx, id);
        try {
            const r = await this.bookingService.rescheduleByCustomer(ctx, id, {
                checkIn,
                checkOut,
                paymentMethod,
            });
            return {
                booking: r.booking,
                applied: r.applied,
                paymentState: r.paymentState,
                paymentId: r.paymentId,
                supplementCent: r.supplementCent,
                paymentPublic: r.paymentPublic ? JSON.stringify(r.paymentPublic) : null,
            };
        }
        catch (e) {
            throw new core_1.UserInputError((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : 'RESCHEDULE_FAILED');
        }
    }
    /** 放弃在途改期补差（取消补差 Payment 并清空意向；归属隔离） */
    async cancelMyRescheduleSupplement(ctx, id) {
        var _a;
        await this.loadOwnedBooking(ctx, id);
        try {
            return await this.bookingService.cancelRescheduleSupplement(ctx, id);
        }
        catch (e) {
            throw new core_1.UserInputError((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : 'RESCHEDULE_SUPPLEMENT_CANCEL_FAILED');
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
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('checkIn')),
    __param(3, (0, graphql_1.Args)('checkOut')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], HotelBookingShopResolver.prototype, "hotelBookingRescheduleQuote", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('checkIn')),
    __param(3, (0, graphql_1.Args)('checkOut')),
    __param(4, (0, graphql_1.Args)('paymentMethod', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], HotelBookingShopResolver.prototype, "rescheduleMyHotelBooking", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], HotelBookingShopResolver.prototype, "cancelMyRescheduleSupplement", null);
exports.HotelBookingShopResolver = HotelBookingShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [booking_service_1.HotelBookingService,
        core_1.CustomerService,
        core_1.TransactionalConnection])
], HotelBookingShopResolver);
//# sourceMappingURL=booking-shop.resolver.js.map