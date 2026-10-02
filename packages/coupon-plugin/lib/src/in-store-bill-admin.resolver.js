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
exports.InStoreBillAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_service_1 = require("./coupon.service");
const in_store_bill_service_1 = require("./in-store-bill.service");
/**
 * 到店买单（admin-api）：商户端核销 + 流水查询。
 * 权限沿用 coupon-plugin 范式：@Allow(Permission.UpdateOrder)，
 * 属店隔离由 service 内的 assertManagedByShop（券模板）+ ctx.channelId（流水）共同保证。
 */
let InStoreBillAdminResolver = class InStoreBillAdminResolver {
    constructor(inStoreBillService, couponService) {
        this.inStoreBillService = inStoreBillService;
        this.couponService = couponService;
    }
    /** 到店收银：某顾客在当前渠道可到店核销的券列表（仅看场景 IN_STORE/ALL + 未使用/未过期） */
    async inStoreCustomerCoupons(ctx, customerId) {
        return this.couponService.listInStoreCoupons(ctx, Number(customerId));
    }
    async inStoreBillQuote(ctx, code, originalAmount) {
        return this.inStoreBillService.quote(ctx, code, originalAmount !== null && originalAmount !== void 0 ? originalAmount : null);
    }
    async inStoreBills(ctx, options) {
        var _a, _b, _c;
        return this.inStoreBillService.list(ctx, {
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20,
            couponCode: (_c = options === null || options === void 0 ? void 0 : options.couponCode) !== null && _c !== void 0 ? _c : undefined,
            from: (options === null || options === void 0 ? void 0 : options.from) ? new Date(options.from) : undefined,
            to: (options === null || options === void 0 ? void 0 : options.to) ? new Date(options.to) : undefined,
        });
    }
    async inStoreBillSummary(ctx, options) {
        return this.inStoreBillService.summary(ctx, {
            from: (options === null || options === void 0 ? void 0 : options.from) ? new Date(options.from) : undefined,
            to: (options === null || options === void 0 ? void 0 : options.to) ? new Date(options.to) : undefined,
        });
    }
    async inStoreBillRedeem(ctx, code, originalAmount, remark) {
        return this.inStoreBillService.redeem(ctx, code, originalAmount, remark);
    }
};
exports.InStoreBillAdminResolver = InStoreBillAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InStoreBillAdminResolver.prototype, "inStoreCustomerCoupons", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __param(2, (0, graphql_1.Args)('originalAmount', { type: () => graphql_1.Int, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number]),
    __metadata("design:returntype", Promise)
], InStoreBillAdminResolver.prototype, "inStoreBillQuote", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InStoreBillAdminResolver.prototype, "inStoreBills", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InStoreBillAdminResolver.prototype, "inStoreBillSummary", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __param(2, (0, graphql_1.Args)('originalAmount', { type: () => graphql_1.Int })),
    __param(3, (0, graphql_1.Args)('remark', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, String]),
    __metadata("design:returntype", Promise)
], InStoreBillAdminResolver.prototype, "inStoreBillRedeem", null);
exports.InStoreBillAdminResolver = InStoreBillAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [in_store_bill_service_1.InStoreBillService,
        coupon_service_1.CouponService])
], InStoreBillAdminResolver);
//# sourceMappingURL=in-store-bill-admin.resolver.js.map