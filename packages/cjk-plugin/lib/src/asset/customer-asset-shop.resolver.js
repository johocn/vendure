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
exports.CustomerAssetShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
/**
 * C 端客户资产上传（F-VS-09）。
 *
 * 售后凭证等场景需要客户端把图片上传到服务端并拿到**可持久访问的 URL**，
 * 而不是把本地临时路径直接当 URL 入库（原实现为占位）。
 * 复用核心 AssetService：服务端按 assetOptions.permittedMimeTypes 校验 MIME、
 * 生成预览图并落库；返回的 Asset 由 AssetInterceptorPlugin 统一转为绝对 URL。
 */
let CustomerAssetShopResolver = class CustomerAssetShopResolver {
    constructor(assetService) {
        this.assetService = assetService;
    }
    async uploadCustomerAsset(ctx, args) {
        const result = await this.assetService.create(ctx, { file: args.file });
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            // MimeTypeError 等：以 UserInputError 抛出，避免前端拿到静默空值
            throw new core_1.UserInputError(result.message);
        }
        return result;
    }
};
exports.CustomerAssetShopResolver = CustomerAssetShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CustomerAssetShopResolver.prototype, "uploadCustomerAsset", null);
exports.CustomerAssetShopResolver = CustomerAssetShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.AssetService])
], CustomerAssetShopResolver);
//# sourceMappingURL=customer-asset-shop.resolver.js.map