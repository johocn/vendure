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
// 酒店预订单 Shop API（P3 Task 11）：C 端「我的预订」（订单详情预订卡，Task 12）数据源
// 归属隔离：按当前登录顾客名下订单过滤，未登录/无顾客返回空列表（绝不返回他人预订）
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const booking_service_1 = require("./booking.service");
let HotelBookingShopResolver = class HotelBookingShopResolver {
    constructor(bookingService, customerService, conn) {
        this.bookingService = bookingService;
        this.customerService = customerService;
        this.conn = conn;
    }
    async myHotelBookings(ctx, status) {
        if (!ctx.activeUserId)
            return [];
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            return [];
        const orderRows = await this.conn
            .getRepository(ctx, core_2.Order)
            .find({ where: { customer: { id: customer.id } }, select: ['id'] });
        return this.bookingService.listForCustomer(ctx, orderRows.map(o => Number(o.id)), status);
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
exports.HotelBookingShopResolver = HotelBookingShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [booking_service_1.HotelBookingService,
        core_1.CustomerService,
        core_1.TransactionalConnection])
], HotelBookingShopResolver);
//# sourceMappingURL=booking-shop.resolver.js.map