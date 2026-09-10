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
    async assetLibrary(ctx, take = 30, skip = 0, tags, ids) {
        const cleanTags = (tags || []).map((t) => String(t).trim()).filter(Boolean);
        const cleanIds = (ids || []).map((i) => String(i).trim()).filter(Boolean);
        // 按 id 精确预取（编辑回填）：商品已选图可能由其他运营上传、也可能不在最近 take 条内。
        // 回填时必须忽略「仅本人上传」的过滤，否则非本人上传的图在编辑页不显示、媒体库确认时又
        // 因看不到而被丢掉 → 商品多图"保存后消失"。prefill=true 仍要求 Authenticated，且 ids 均来自
        // 用户当前正在编辑、已有权限查看的商品，属合理可见范围。
        const filtered = await this.loadFiltered(ctx, cleanIds.length > 0);
        let finalList = cleanTags.length
            ? filtered.filter((a) => {
                var _a;
                const assetTags = ((_a = a.customFields) === null || _a === void 0 ? void 0 : _a.assetTags) || [];
                return assetTags.some((t) => cleanTags.includes(t));
            })
            : filtered;
        // ids 模式下忽略分页，返回全部匹配项（编辑回填必须保住这些已选资源）。
        if (cleanIds.length) {
            const idSet = new Set(cleanIds);
            finalList = filtered.filter((a) => idSet.has(String(a.id)));
        }
        const total = finalList.length;
        const slice = cleanIds.length ? finalList : finalList.slice(skip, skip + take);
        return {
            items: slice.map((a) => this.toAssetItem(ctx, a)),
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
    async loadFiltered(ctx, prefill = false) {
        var _a, _b;
        const user = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user;
        const channelPerms = (user === null || user === void 0 ? void 0 : user.channelPermissions) || [];
        const isSuperAdmin = (user === null || user === void 0 ? void 0 : user.superAdmin) === true ||
            channelPerms.some((cp) => (cp.permissions || []).includes(core_1.Permission.SuperAdmin));
        // 直接用仓库拖取该渠道全部资产（绕开 ListQueryBuilder 的 adminListQueryLimit 上限——
        // 之前用 assetService.findAll(take:100000) 会因超过默认 1000 上限抛
        // "Cannot take more than 1000 results" 导致图片库整体打不开），再按上传者过滤。
        const repo = this.connection.getRepository(ctx, core_2.Asset);
        const all = await repo.find({ order: { createdAt: 'DESC' } });
        let filtered = all;
        // prefill（按 id 编辑回填）：跳过「仅本人上传」过滤，保证商品已挂接图片可见、媒体库确认不丢图。
        if (!isSuperAdmin && !prefill) {
            const mine = String((_b = user === null || user === void 0 ? void 0 : user.id) !== null && _b !== void 0 ? _b : '');
            filtered = all.filter((a) => { var _a, _b; return String((_b = (_a = a.customFields) === null || _a === void 0 ? void 0 : _a.uploadedBy) !== null && _b !== void 0 ? _b : '') === mine; });
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
    toAssetItem(ctx, a) {
        var _a;
        const origin = this.requestOrigin(ctx);
        // Asset 实体存储的是相对路径(preview/… 无 assets 前缀)；媒体库模板直接 <image :src="preview">
        // 用裸相对路径会解析成 /guanli/preview/… → 命中 SPA 返回 index.html 而非图片，缩略图全破。
        // 这里统一拼成绝对 URL(origin + /assets/ + path)，所有消费媒体库的组件无需再做前缀处理。
        const prefix = origin ? `${origin}/assets/` : 'assets/';
        return {
            id: String(a.id),
            name: a.name || '',
            preview: prefix + a.preview,
            source: prefix + a.source,
            mimeType: a.mimeType,
            width: a.width,
            height: a.height,
            assetTags: ((_a = a.customFields) === null || _a === void 0 ? void 0 : _a.assetTags) || [],
        };
    }
    requestOrigin(ctx) {
        var _a, _b, _c, _d;
        const req = ctx.req;
        const host = ((_a = req === null || req === void 0 ? void 0 : req.headers) === null || _a === void 0 ? void 0 : _a.host) || '';
        if (!host)
            return '';
        const proto = ((_d = (_c = (_b = req === null || req === void 0 ? void 0 : req.headers) === null || _b === void 0 ? void 0 : _b['x-forwarded-proto']) === null || _c === void 0 ? void 0 : _c.split(',')[0]) === null || _d === void 0 ? void 0 : _d.trim()) ||
            (req === null || req === void 0 ? void 0 : req.protocol) ||
            (host.includes('localhost') ? 'http' : 'https');
        return `${proto}://${host}`;
    }
};
exports.AssetLibraryAdminResolver = AssetLibraryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('take', { type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)('skip', { type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)('tags', { type: () => [String], nullable: true })),
    __param(4, (0, graphql_1.Args)('ids', { type: () => [String], nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Array, Array]),
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