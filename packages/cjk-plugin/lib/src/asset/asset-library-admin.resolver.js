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
 * 按当前登录用户过滤的资产图库 + 租户级图片分类标签（assetTags）。
 * - 超管：返回全部资产；普通后台用户：仅返回 uploadedBy == 当前用户 id 的资产。
 * - uploadedBy 写入路径：前端 uploadAsset 上传时在 customFields 传当前 admin 用户 id。
 * - assetTags（分类码）挂在各 Asset 上 → 天然按 channel(租户) 隔离，不会跨租户串。
 */
let AssetLibraryAdminResolver = class AssetLibraryAdminResolver {
    constructor(assetService, connection) {
        this.assetService = assetService;
        this.connection = connection;
    }
    async assetLibrary(ctx, take = 30, skip = 0, tag) {
        const filtered = await this.loadFiltered(ctx);
        const byTag = (tag || '').trim();
        const finalList = byTag
            ? filtered.filter((a) => { var _a; return (((_a = a.customFields) === null || _a === void 0 ? void 0 : _a.assetTags) || []).some((t) => t === byTag); })
            : filtered;
        const total = finalList.length;
        const slice = finalList.slice(skip, skip + take);
        return {
            items: slice.map((a) => this.toAssetItem(a)),
            totalItems: total,
        };
    }
    /** 当前租户（普通用户则本人）可用的图片分类码清单 */
    async assetTags(ctx, take = 100) {
        var _a;
        const filtered = await this.loadFiltered(ctx);
        const agg = new Map();
        for (const a of filtered) {
            const tags = ((_a = a.customFields) === null || _a === void 0 ? void 0 : _a.assetTags) || [];
            for (const t of tags) {
                const k = String(t);
                if (k)
                    agg.set(k, (agg.get(k) || 0) + 1);
            }
        }
        const list = Array.from(agg.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((x, y) => y.count - x.count);
        return list.slice(0, take);
    }
    /** 给指定图片设置分类码（整组覆盖）。仅允许操作当前 channel 下(或超管)的资产，避免跨租户越权。 */
    async setAssetTags(ctx, assetIds, tags) {
        const clean = (tags || []).map((t) => String(t).trim()).filter(Boolean);
        const repo = this.connection.getRepository(ctx, core_2.Asset);
        for (const id of assetIds) {
            const asset = await repo.findOne({ where: { id: String(id) }, relations: ['channels'] });
            if (!asset)
                continue;
            this.assertOwned(ctx, asset);
            asset.customFields = Object.assign(Object.assign({}, (asset.customFields || {})), { assetTags: clean });
            await repo.save(asset);
        }
        return true;
    }
    async loadFiltered(ctx) {
        var _a, _b;
        const user = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user;
        const channelPerms = (user === null || user === void 0 ? void 0 : user.channelPermissions) || [];
        const isSuperAdmin = (user === null || user === void 0 ? void 0 : user.superAdmin) === true ||
            channelPerms.some((cp) => (cp.permissions || []).includes(core_1.Permission.SuperAdmin));
        // 拉取该渠道全部资产，再按上传者过滤 —— 避免跨库 JSON 过滤副作用
        const all = await this.assetService.findAll(ctx, {
            take: 100000,
            sort: { createdAt: 'DESC' },
        });
        let filtered = all.items;
        if (!isSuperAdmin) {
            const mine = String((_b = user === null || user === void 0 ? void 0 : user.id) !== null && _b !== void 0 ? _b : '');
            filtered = all.items.filter((a) => { var _a, _b; return String((_b = (_a = a.customFields) === null || _a === void 0 ? void 0 : _a.uploadedBy) !== null && _b !== void 0 ? _b : '') === mine; });
        }
        return filtered;
    }
    assertOwned(ctx, asset) {
        var _a;
        const user = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user;
        const channelPerms = (user === null || user === void 0 ? void 0 : user.channelPermissions) || [];
        const isSuperAdmin = (user === null || user === void 0 ? void 0 : user.superAdmin) === true ||
            channelPerms.some((cp) => (cp.permissions || []).includes(core_1.Permission.SuperAdmin));
        if (isSuperAdmin)
            return;
        const inChannel = (asset.channels || []).some((c) => String(c.id) === String(ctx.channelId));
        if (!inChannel) {
            throw new core_1.UserInputError('不能操作不属于当前店铺的图片');
        }
    }
    toAssetItem(a) {
        var _a;
        return {
            id: String(a.id),
            name: a.name || '',
            preview: a.preview,
            source: a.source,
            mimeType: a.mimeType,
            width: a.width,
            height: a.height,
            assetTags: ((_a = a.customFields) === null || _a === void 0 ? void 0 : _a.assetTags) || [],
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
    __param(3, (0, graphql_1.Args)('tag', { type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, String]),
    __metadata("design:returntype", Promise)
], AssetLibraryAdminResolver.prototype, "assetLibrary", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('take', { type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AssetLibraryAdminResolver.prototype, "assetTags", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('assetIds', { type: () => [String] })),
    __param(2, (0, graphql_1.Args)('tags', { type: () => [String], nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array, Array]),
    __metadata("design:returntype", Promise)
], AssetLibraryAdminResolver.prototype, "setAssetTags", null);
exports.AssetLibraryAdminResolver = AssetLibraryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(core_1.AssetService)),
    __param(1, (0, common_1.Inject)(core_2.TransactionalConnection)),
    __metadata("design:paramtypes", [core_1.AssetService,
        core_2.TransactionalConnection])
], AssetLibraryAdminResolver);
//# sourceMappingURL=asset-library-admin.resolver.js.map