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
exports.CouponBindingAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_binding_service_1 = require("./coupon-binding.service");
/**
 * 商品绑券后台管理（admin-api）：查询商品下全部绑定（含停用）、创建/更新/删除绑定。
 * 权限与券模板管理一致（Permission.UpdateOrder），租户隔离在 service 内按渠道过滤。
 */
let CouponBindingAdminResolver = class CouponBindingAdminResolver {
    constructor(bindingService) {
        this.bindingService = bindingService;
    }
    async productCouponBindings(ctx, productId) {
        return this.bindingService.listByProductAdmin(ctx, Number(productId));
    }
    async createProductCouponBinding(ctx, input) {
        return this.bindingService.create(ctx, input);
    }
    async updateProductCouponBinding(ctx, input) {
        return this.bindingService.update(ctx, input);
    }
    async deleteProductCouponBinding(ctx, id) {
        await this.bindingService.delete(ctx, id);
        return true;
    }
};
exports.CouponBindingAdminResolver = CouponBindingAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponBindingAdminResolver.prototype, "productCouponBindings", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponBindingAdminResolver.prototype, "createProductCouponBinding", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponBindingAdminResolver.prototype, "updateProductCouponBinding", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponBindingAdminResolver.prototype, "deleteProductCouponBinding", null);
exports.CouponBindingAdminResolver = CouponBindingAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_binding_service_1.CouponBindingService])
], CouponBindingAdminResolver);
//# sourceMappingURL=coupon-binding-admin.resolver.js.map