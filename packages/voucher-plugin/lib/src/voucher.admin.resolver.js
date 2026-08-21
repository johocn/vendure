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
exports.VoucherAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const voucher_service_1 = require("./voucher.service");
/**
 * 管理端券接口。核销/延期/换券均经 service 层 requireMyShop 校验当前活跃用户为 active 店主
 * （归属隔离由 Shop.administratorId 把关），因此 schema 侧仅需 Authenticated 保底，
 * 真正的授权由 requireMyShop 兜底。
 */
let VoucherAdminResolver = class VoucherAdminResolver {
    constructor(service) {
        this.service = service;
    }
    /** 扫码展示：店主按 code 查回本店券。 */
    async scanVoucher(ctx, code) {
        return this.service.findVoucher(ctx, code);
    }
    /** 管理端全局券列表（本 channel）。 */
    async myVouchersAdmin(ctx) {
        return this.service.vouchers(ctx);
    }
    /** 某券的预约档。 */
    async voucherBookings(ctx, voucherId) {
        return this.service.bookingsForVoucher(ctx, voucherId);
    }
    /** 店主核销：usable → used。 */
    async redeemVoucher(ctx, code) {
        return this.service.redeemVoucher(ctx, code);
    }
    async extendVoucher(ctx, voucherId, days) {
        return this.service.extendVoucher(ctx, voucherId, days);
    }
    async exchangeVoucher(ctx, voucherId) {
        return this.service.exchangeVoucher(ctx, voucherId);
    }
    /** 创建预约档（幂等：一券一档）。 */
    async createBooking(ctx, voucherId, slotAt, customerCount) {
        return this.service.createBooking(ctx, voucherId, slotAt, customerCount);
    }
    /** 触发过期扫描（或由 JobQueue 定时调用）。 */
    async runExpireScan(ctx) {
        return this.service.markExpired(ctx);
    }
};
exports.VoucherAdminResolver = VoucherAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], VoucherAdminResolver.prototype, "scanVoucher", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], VoucherAdminResolver.prototype, "myVouchersAdmin", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('voucherId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], VoucherAdminResolver.prototype, "voucherBookings", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], VoucherAdminResolver.prototype, "redeemVoucher", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('voucherId')),
    __param(2, (0, graphql_1.Args)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number]),
    __metadata("design:returntype", Promise)
], VoucherAdminResolver.prototype, "extendVoucher", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('voucherId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], VoucherAdminResolver.prototype, "exchangeVoucher", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('voucherId')),
    __param(2, (0, graphql_1.Args)('slotAt')),
    __param(3, (0, graphql_1.Args)('customerCount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Date, Number]),
    __metadata("design:returntype", Promise)
], VoucherAdminResolver.prototype, "createBooking", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], VoucherAdminResolver.prototype, "runExpireScan", null);
exports.VoucherAdminResolver = VoucherAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [voucher_service_1.VoucherService])
], VoucherAdminResolver);
//# sourceMappingURL=voucher.admin.resolver.js.map