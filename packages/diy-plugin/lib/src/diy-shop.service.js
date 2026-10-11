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
exports.DiyShopService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const constants_1 = require("./constants");
const diy_category_entity_1 = require("./entities/diy-category.entity");
const diy_material_entity_1 = require("./entities/diy-material.entity");
const diy_template_entity_1 = require("./entities/diy-template.entity");
const material_merge_1 = require("./material-merge");
/**
 * C 端查询面（规格 §7 shop 部分）。
 * app 固定取插件 init 传入的租户端，不暴露给 C 端调用方。
 */
let DiyShopService = class DiyShopService {
    constructor(options, connection) {
        this.options = options;
        this.connection = connection;
    }
    get app() {
        var _a;
        return (_a = this.options.app) !== null && _a !== void 0 ? _a : 'nshop';
    }
    /** C 端素材列表：两层合并去重后内存过滤 + 分页（素材量级千内，内存过滤足够） */
    async findShopMaterials(ctx, filter = {}) {
        var _a, _b, _c, _d, _e;
        const repo = this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial);
        const [platform, tenant] = await Promise.all([
            repo.find({ where: { app: (0, typeorm_1.IsNull)() }, order: { sortOrder: 'ASC', id: 'ASC' } }),
            repo.find({ where: { app: this.app }, order: { sortOrder: 'ASC', id: 'ASC' } }),
        ]);
        let items = (0, material_merge_1.mergeMaterials)(platform, tenant);
        if (filter.categoryCode) {
            const allowed = (_a = (await this.categoryIdsByCode(ctx)).get(filter.categoryCode)) !== null && _a !== void 0 ? _a : new Set();
            items = items.filter(m => allowed.has(m.categoryId));
        }
        if (filter.categoryId != null) {
            items = items.filter(m => m.categoryId === filter.categoryId);
        }
        if ((_b = filter.shapes) === null || _b === void 0 ? void 0 : _b.length) {
            items = items.filter(m => filter.shapes.includes(m.shape));
        }
        if (filter.diameterMin != null || filter.diameterMax != null) {
            items = items.filter(m => m.diameter != null &&
                (filter.diameterMin == null || m.diameter >= filter.diameterMin) &&
                (filter.diameterMax == null || m.diameter <= filter.diameterMax));
        }
        const kw = (_c = filter.keyword) === null || _c === void 0 ? void 0 : _c.trim().toLowerCase();
        if (kw) {
            items = items.filter(m => this.matchKeyword(m, kw));
        }
        if (filter.onlyEnabled) {
            items = items.filter(m => m.enabled);
        }
        const total = items.length;
        const skip = (_d = filter.skip) !== null && _d !== void 0 ? _d : 0;
        const take = (_e = filter.take) !== null && _e !== void 0 ? _e : 50;
        return { items: items.slice(skip, skip + take), total };
    }
    matchKeyword(m, kw) {
        var _a;
        if (m.code.toLowerCase().includes(kw)) {
            return true;
        }
        const values = typeof m.name === 'string' ? [m.name] : Object.values((_a = m.name) !== null && _a !== void 0 ? _a : {});
        return values.some(v => typeof v === 'string' && v.toLowerCase().includes(kw));
    }
    /** categoryCode → 该码下两层分类 id 集合（分类并集、无覆盖） */
    async categoryIdsByCode(ctx) {
        var _a;
        const repo = this.connection.getRepository(ctx, diy_category_entity_1.DiyCategory);
        const cats = await repo.find();
        const map = new Map();
        for (const c of cats) {
            if (!c.code) {
                continue;
            }
            const set = (_a = map.get(c.code)) !== null && _a !== void 0 ? _a : new Set();
            set.add(c.id);
            map.set(c.code, set);
        }
        return map;
    }
    /** C 端模板列表：两层 enabled 模板，同 code 租户覆盖平台（模板无复制回链列） */
    async findShopTemplates(ctx) {
        const repo = this.connection.getRepository(ctx, diy_template_entity_1.DiyTemplate);
        const [platform, tenant] = await Promise.all([
            repo.find({ where: { app: (0, typeorm_1.IsNull)(), status: 'enabled' }, order: { sortOrder: 'ASC', id: 'ASC' } }),
            repo.find({ where: { app: this.app, status: 'enabled' }, order: { sortOrder: 'ASC', id: 'ASC' } }),
        ]);
        const tenantCodes = new Set(tenant.map(t => t.code));
        return [...platform.filter(p => !tenantCodes.has(p.code)), ...tenant];
    }
    /** C 端单模板：租户优先、其次平台，仅 enabled；不存在/未启用返回 null */
    async findShopTemplateByCode(ctx, code) {
        const repo = this.connection.getRepository(ctx, diy_template_entity_1.DiyTemplate);
        const tenant = await repo.findOne({ where: { app: this.app, code, status: 'enabled' } });
        if (tenant) {
            return tenant;
        }
        return repo.findOne({ where: { app: (0, typeorm_1.IsNull)(), code, status: 'enabled' } });
    }
};
exports.DiyShopService = DiyShopService;
exports.DiyShopService = DiyShopService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection])
], DiyShopService);
//# sourceMappingURL=diy-shop.service.js.map