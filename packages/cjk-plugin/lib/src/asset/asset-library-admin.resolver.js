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
exports.AssetLibraryAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
/**
 * 按当前登录用户过滤的资产图库。
 * - 超管：返回全部资产
 * - 普通后台用户：仅返回 uploadedBy == 当前用户 id 的资产（用户只看到自己上传的媒体，参照课程后台语义）
 * uploadedBy 写入路径：前端 uploadAsset 上传时在 customFields 传当前 admin 用户 id。
 */
let AssetLibraryAdminResolver = class AssetLibraryAdminResolver {
    constructor(assetService, connection) {
        this.assetService = assetService;
        this.connection = connection;
    }
    async assetLibrary(ctx, take = 30, skip = 0) {
        var _a, _b;
        const user = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user;
        const channelPerms = (user === null || user === void 0 ? void 0 : user.channelPermissions) || [];
        const isSuperAdmin = (user === null || user === void 0 ? void 0 : user.superAdmin) === true ||
            channelPerms.some((cp) => (cp.permissions || []).includes(core_1.Permission.SuperAdmin));
        // 拉取该渠道全部资产（图库规模可控），再按上传者过滤 —— 避免跨库 JSON 过滤副作用
        const all = await this.assetService.findAll(ctx, {
            take: 100000,
            sort: { createdAt: 'DESC' },
        });
        let filtered = all.items;
        if (!isSuperAdmin) {
            const mine = String((_b = user === null || user === void 0 ? void 0 : user.id) !== null && _b !== void 0 ? _b : '');
            filtered = all.items.filter((a) => { var _a, _b; return String((_b = (_a = a.customFields) === null || _a === void 0 ? void 0 : _a.uploadedBy) !== null && _b !== void 0 ? _b : '') === mine; });
        }
        const total = filtered.length;
        const slice = filtered.slice(skip, skip + take);
        return {
            items: slice.map((a) => this.toAssetItem(a)),
            totalItems: total,
        };
    }
    toAssetItem(a) {
        return {
            id: String(a.id),
            name: a.name || '',
            preview: a.preview,
            source: a.source,
            mimeType: a.mimeType,
            width: a.width,
            height: a.height,
        };
    }
};
exports.AssetLibraryAdminResolver = AssetLibraryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('take', { type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)('skip', { type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], AssetLibraryAdminResolver.prototype, "assetLibrary", null);
exports.AssetLibraryAdminResolver = AssetLibraryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(core_1.AssetService)),
    __param(1, (0, common_1.Inject)(core_2.TransactionalConnection)),
    __metadata("design:paramtypes", [core_1.AssetService,
        core_2.TransactionalConnection])
], AssetLibraryAdminResolver);
//# sourceMappingURL=asset-library-admin.resolver.js.map