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
exports.HotelRatePlanAdminResolver = void 0;
// 房价方案管理 Admin API（P2 Task 7）：web-admin「房价方案」卡的读写入口
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const rate_plan_service_1 = require("./rate-plan.service");
let HotelRatePlanAdminResolver = class HotelRatePlanAdminResolver {
    constructor(ratePlanService) {
        this.ratePlanService = ratePlanService;
    }
    async hotelRatePlans(ctx, variantId) {
        return this.ratePlanService.listByVariant(ctx, variantId);
    }
    async createHotelRatePlan(ctx, variantId, input) {
        return this.ratePlanService.create(ctx, variantId, input);
    }
    async updateHotelRatePlan(ctx, id, input) {
        return this.ratePlanService.update(ctx, id, input);
    }
    async deleteHotelRatePlan(ctx, id) {
        return this.ratePlanService.delete(ctx, id);
    }
};
exports.HotelRatePlanAdminResolver = HotelRatePlanAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog, core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], HotelRatePlanAdminResolver.prototype, "hotelRatePlans", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantId')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], HotelRatePlanAdminResolver.prototype, "createHotelRatePlan", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], HotelRatePlanAdminResolver.prototype, "updateHotelRatePlan", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], HotelRatePlanAdminResolver.prototype, "deleteHotelRatePlan", null);
exports.HotelRatePlanAdminResolver = HotelRatePlanAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [rate_plan_service_1.HotelRatePlanService])
], HotelRatePlanAdminResolver);
//# sourceMappingURL=rate-plan-admin.resolver.js.map