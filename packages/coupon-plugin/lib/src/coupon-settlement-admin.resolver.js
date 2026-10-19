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
exports.CouponSettlementAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_settlement_service_1 = require("./coupon-settlement.service");
/**
 * 券结算单后台（admin-api，T1）：结算流水查询 + 手动触发汇总周期（运维）。
 * 权限对齐券商城后台（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
let CouponSettlementAdminResolver = class CouponSettlementAdminResolver {
    constructor(settlementService) {
        this.settlementService = settlementService;
    }
    async couponSettlementOrders(ctx, options) {
        var _a, _b, _c;
        return this.settlementService.listSettlements(ctx, {
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20,
            status: (_c = options === null || options === void 0 ? void 0 : options.status) !== null && _c !== void 0 ? _c : undefined,
        });
    }
    async couponSettlementOrder(ctx, id) {
        return this.settlementService.findSettlement(ctx, Number(id));
    }
    /** 手动触发 T+1 汇总周期（补登 → 提交分账 → 回执推进），运维排查用 */
    async runCouponSettlementCycle(ctx) {
        return this.settlementService.manualRunCycle(ctx);
    }
};
exports.CouponSettlementAdminResolver = CouponSettlementAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSettlementAdminResolver.prototype, "couponSettlementOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSettlementAdminResolver.prototype, "couponSettlementOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CouponSettlementAdminResolver.prototype, "runCouponSettlementCycle", null);
exports.CouponSettlementAdminResolver = CouponSettlementAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_settlement_service_1.CouponSettlementService])
], CouponSettlementAdminResolver);
//# sourceMappingURL=coupon-settlement-admin.resolver.js.map