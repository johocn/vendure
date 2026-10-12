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
const calc_1 = require("@diy/calc");
const typeorm_1 = require("typeorm");
const constants_1 = require("./constants");
const quote_utils_1 = require("./quote-utils");
const calc_bridge_1 = require("./calc-bridge");
const diy_category_entity_1 = require("./entities/diy-category.entity");
const diy_material_entity_1 = require("./entities/diy-material.entity");
const diy_plan_entity_1 = require("./entities/diy-plan.entity");
const diy_template_entity_1 = require("./entities/diy-template.entity");
const template_config_1 = require("./template-config");
const material_merge_1 = require("./material-merge");
const plan_utils_1 = require("./plan-utils");
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
    /** C 端分类列表：平台 + 租户两层并集（无覆盖），仅 enabled，sortOrder 升序 */
    async findShopCategories(ctx) {
        const repo = this.connection.getRepository(ctx, diy_category_entity_1.DiyCategory);
        const [platform, tenant] = await Promise.all([
            repo.find({ where: { app: (0, typeorm_1.IsNull)() } }),
            repo.find({ where: { app: this.app } }),
        ]);
        return (0, material_merge_1.unionCategories)(platform, tenant);
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
    /* ------------------------- 方案（规格 §6.2） ------------------------- */
    /** C 端创建方案（可匿名演示）：required 槽位校验 → 合并素材 → 服务端复算 → draft 落库（价格快照） */
    async createDiyPlan(ctx, input) {
        var _a, _b;
        const template = await this.findShopTemplateByCode(ctx, input.templateCode);
        if (!template) {
            throw new core_1.UserInputError(`Diy template not found: ${input.templateCode}`);
        }
        const parsed = (0, template_config_1.parseTemplateConfig)(template.config);
        if (!parsed) {
            throw new core_1.UserInputError(`Invalid template config: ${template.code}`);
        }
        for (const slot of parsed.slots) {
            if (slot.required && !((_a = input.spec.slots[slot.key]) === null || _a === void 0 ? void 0 : _a.materialId)) {
                throw new core_1.UserInputError(`Slot "${slot.key}" is required`);
            }
        }
        // 仅启用素材参与复算：素材禁用/删除 → 合并视图缺席 → runDiyCalc 抛错
        const materialList = await this.findShopMaterials(ctx, { onlyEnabled: true, take: 100000 });
        const { bom } = (0, calc_bridge_1.runDiyCalc)(template, input.spec, materialList.items, ctx.languageCode);
        return this.connection.getRepository(ctx, diy_plan_entity_1.DiyPlan).save(new diy_plan_entity_1.DiyPlan({
            app: this.app,
            userId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            templateId: Number(template.id),
            templateVersion: template.version,
            status: 'draft',
            spec: input.spec,
            bom: (0, calc_bridge_1.toPlanBom)(bom),
            calcVersion: calc_1.CALC_VERSION,
            thumb: (_b = input.thumb) !== null && _b !== void 0 ? _b : null,
        }));
    }
    /** 我的方案列表（未登录返回空页） */
    async myDiyPlans(ctx, options = {}) {
        var _a, _b;
        const userId = ctx.activeUserId;
        if (!userId) {
            return { items: [], total: 0 };
        }
        const [items, total] = await this.connection
            .getRepository(ctx, diy_plan_entity_1.DiyPlan)
            .findAndCount({
            where: Object.assign({ app: this.app, userId: Number(userId) }, (options.status ? { status: options.status } : {})),
            order: { createdAt: 'DESC', id: 'DESC' },
            skip: (_a = options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options.take) !== null && _b !== void 0 ? _b : 20,
        });
        return { items, total };
    }
    /** 我的方案详情（仅本人可见，他人/跨租户一律 null） */
    async myDiyPlan(ctx, id) {
        const userId = ctx.activeUserId;
        if (!userId) {
            return null;
        }
        const plan = await this.connection
            .getRepository(ctx, diy_plan_entity_1.DiyPlan)
            .findOne({ where: { app: this.app, id: Number(id) } });
        return plan && plan.userId === Number(userId) ? plan : null;
    }
    /** 报价（规格 §6.3）：draft/quoted 可重复报价（每次以服务端实时价复算覆盖 bom，新号新效期）；ordered 不可 */
    async quoteDiyPlan(ctx, planId) {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new core_1.ForbiddenError();
        }
        const repo = this.connection.getRepository(ctx, diy_plan_entity_1.DiyPlan);
        const plan = await repo.findOne({ where: { app: this.app, id: Number(planId) } });
        if (!plan || plan.userId !== Number(userId)) {
            throw new core_1.UserInputError(`Diy plan not found: ${planId}`);
        }
        if (plan.status === 'ordered') {
            throw new core_1.UserInputError(`Diy plan ${plan.id} already ordered`);
        }
        const template = await this.connection
            .getRepository(ctx, diy_template_entity_1.DiyTemplate)
            .findOne({ where: { id: plan.templateId } });
        if (!template || template.status !== 'enabled') {
            throw new core_1.UserInputError(`Diy template not available`);
        }
        // 服务端实时价为唯一价格权威；素材禁用/删除 → 合并视图缺席 → runDiyCalc 抛错
        const materialList = await this.findShopMaterials(ctx, { onlyEnabled: true, take: 100000 });
        const { bom } = (0, calc_bridge_1.runDiyCalc)(template, plan.spec, materialList.items, ctx.languageCode);
        const now = new Date();
        plan.status = 'quoted';
        plan.bom = (0, calc_bridge_1.toPlanBom)(bom);
        plan.calcVersion = calc_1.CALC_VERSION;
        plan.quoteNo = (0, quote_utils_1.buildQuoteNo)(now);
        plan.expiresAt = (0, quote_utils_1.quoteExpiresAt)(now, constants_1.DEFAULT_QUOTE_TTL_DAYS);
        return repo.save(plan);
    }
    /* ------------------------- v2：公开分享 / 画廊 ------------------------- */
    toGalleryItem(plan) {
        var _a, _b, _c, _d;
        return {
            id: String(plan.id),
            title: (0, plan_utils_1.derivePlanTitle)(plan.spec, plan.bom),
            coverMaterialIds: (0, plan_utils_1.coverMaterialIds)(plan.spec),
            totalAmount: (_b = (_a = plan.bom) === null || _a === void 0 ? void 0 : _a.totalAmount) !== null && _b !== void 0 ? _b : 0,
            totalCount: (_d = (_c = plan.bom) === null || _c === void 0 ? void 0 : _c.totalCount) !== null && _d !== void 0 ? _d : 0,
            authorName: null,
            createdAt: plan.createdAt,
        };
    }
    /** 公开画廊：仅 isPublic=true，按发布时间倒序，take 上限 50 */
    async diyGalleryPlans(ctx, options = {}) {
        var _a, _b;
        const [plans, total] = await this.connection
            .getRepository(ctx, diy_plan_entity_1.DiyPlan)
            .findAndCount({
            where: { app: this.app, isPublic: true },
            order: { publishedAt: 'DESC', id: 'DESC' },
            skip: (_a = options.skip) !== null && _a !== void 0 ? _a : 0,
            take: Math.min(Math.max(1, (_b = options.take) !== null && _b !== void 0 ? _b : 12), 50),
        });
        return { items: plans.map(p => this.toGalleryItem(p)), total };
    }
    /** 公开方案详情（分享页）：仅 isPublic=true，否则统一 PLAN_NOT_ACCESSIBLE（不暴露存在性） */
    async diyPublicPlan(ctx, id) {
        var _a, _b, _c, _d;
        const plan = await this.connection
            .getRepository(ctx, diy_plan_entity_1.DiyPlan)
            .findOne({ where: { app: this.app, id: Number(id), isPublic: true } });
        if (!plan) {
            throw new core_1.UserInputError('PLAN_NOT_ACCESSIBLE');
        }
        return {
            id: String(plan.id),
            title: (0, plan_utils_1.derivePlanTitle)(plan.spec, plan.bom),
            spec: plan.spec,
            totalAmount: (_b = (_a = plan.bom) === null || _a === void 0 ? void 0 : _a.totalAmount) !== null && _b !== void 0 ? _b : 0,
            totalCount: (_d = (_c = plan.bom) === null || _c === void 0 ? void 0 : _c.totalCount) !== null && _d !== void 0 ? _d : 0,
            createdAt: plan.createdAt,
        };
    }
    /** 发布/取消发布（仅 owner）：发布记 publishedAt=now，取消置 null */
    async publishDiyPlan(ctx, id, isPublic) {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new core_1.ForbiddenError();
        }
        const repo = this.connection.getRepository(ctx, diy_plan_entity_1.DiyPlan);
        const plan = await repo.findOne({ where: { app: this.app, id: Number(id) } });
        if (!plan || plan.userId !== Number(userId)) {
            throw new core_1.UserInputError('PLAN_NOT_FOUND_OR_NOT_OWNER');
        }
        plan.isPublic = isPublic;
        plan.publishedAt = isPublic ? new Date() : null;
        return repo.save(plan);
    }
    /** 复制方案（owner 或 isPublic=true 可复制）：复制体归属当前用户、回到 draft、不公开，spec/bom 原样 */
    async copyDiyPlan(ctx, id) {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new core_1.ForbiddenError();
        }
        const repo = this.connection.getRepository(ctx, diy_plan_entity_1.DiyPlan);
        const plan = await repo.findOne({ where: { app: this.app, id: Number(id) } });
        if (!plan || (plan.userId !== Number(userId) && !plan.isPublic)) {
            throw new core_1.UserInputError('PLAN_NOT_ACCESSIBLE');
        }
        return repo.save(new diy_plan_entity_1.DiyPlan({
            app: this.app,
            userId: Number(userId),
            templateId: plan.templateId,
            templateVersion: plan.templateVersion,
            status: 'draft',
            spec: plan.spec,
            bom: plan.bom,
            calcVersion: plan.calcVersion,
            thumb: plan.thumb,
            isPublic: false,
            publishedAt: null,
        }));
    }
};
exports.DiyShopService = DiyShopService;
exports.DiyShopService = DiyShopService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection])
], DiyShopService);
//# sourceMappingURL=diy-shop.service.js.map