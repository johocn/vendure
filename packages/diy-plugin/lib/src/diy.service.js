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
exports.DiyService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const diy_category_entity_1 = require("./entities/diy-category.entity");
const diy_material_entity_1 = require("./entities/diy-material.entity");
const diy_plan_entity_1 = require("./entities/diy-plan.entity");
const diy_template_entity_1 = require("./entities/diy-template.entity");
let DiyService = class DiyService {
    constructor(connection, options) {
        this.connection = connection;
        this.options = options;
    }
    /* ------------------------------ 分类 ------------------------------ */
    /** app 传 undefined = 全部（管理端），传 null = 仅平台 */
    async findCategories(ctx, app) {
        const repo = this.connection.getRepository(ctx, diy_category_entity_1.DiyCategory);
        const qb = repo.createQueryBuilder('cat');
        if (app !== undefined) {
            qb.where('cat.app = :app', { app });
        }
        return qb.orderBy('cat.sortOrder', 'ASC').addOrderBy('cat.id', 'ASC').getMany();
    }
    async findOneCategory(ctx, id) {
        return this.connection.getRepository(ctx, diy_category_entity_1.DiyCategory).findOne({ where: { id: id } });
    }
    async createCategory(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const repo = this.connection.getRepository(ctx, diy_category_entity_1.DiyCategory);
        if (input.code) {
            const dup = await repo.findOne({ where: { app: ((_a = input.app) !== null && _a !== void 0 ? _a : null), code: input.code } });
            if (dup) {
                throw new core_1.UserInputError(`分类 code 已存在: ${input.code}`);
            }
        }
        const cat = new diy_category_entity_1.DiyCategory({
            app: (_b = input.app) !== null && _b !== void 0 ? _b : null,
            code: (_c = input.code) !== null && _c !== void 0 ? _c : null,
            parentId: (_d = input.parentId) !== null && _d !== void 0 ? _d : null,
            name: ((_e = input.name) !== null && _e !== void 0 ? _e : {}),
            image: (_f = input.image) !== null && _f !== void 0 ? _f : null,
            sortOrder: (_g = input.sortOrder) !== null && _g !== void 0 ? _g : 0,
            enabled: (_h = input.enabled) !== null && _h !== void 0 ? _h : true,
        });
        return repo.save(cat);
    }
    async updateCategory(ctx, input) {
        const repo = this.connection.getRepository(ctx, diy_category_entity_1.DiyCategory);
        const cat = await repo.findOne({ where: { id: input.id } });
        if (!cat) {
            throw new core_1.UserInputError('分类不存在');
        }
        if (input.code !== undefined)
            cat.code = input.code;
        if (input.parentId !== undefined)
            cat.parentId = input.parentId;
        if (input.name !== undefined)
            cat.name = input.name;
        if (input.image !== undefined)
            cat.image = input.image;
        if (input.sortOrder !== undefined)
            cat.sortOrder = input.sortOrder;
        if (input.enabled !== undefined)
            cat.enabled = input.enabled;
        return repo.save(cat);
    }
    async deleteCategory(ctx, id) {
        const repo = this.connection.getRepository(ctx, diy_category_entity_1.DiyCategory);
        const cat = await repo.findOne({ where: { id: id } });
        if (!cat) {
            return false;
        }
        const used = await this.connection
            .getRepository(ctx, diy_material_entity_1.DiyMaterial)
            .count({ where: { categoryId: Number(id) } });
        if (used > 0) {
            throw new core_1.UserInputError(`分类下存在 ${used} 个素材，禁止删除`);
        }
        await repo.remove(cat);
        return true;
    }
    /* ------------------------------ 素材 ------------------------------ */
    async findMaterials(ctx, app, skip = 0, take = 100) {
        const qb = this.connection
            .getRepository(ctx, diy_material_entity_1.DiyMaterial)
            .createQueryBuilder('mat')
            .skip(skip)
            .take(Math.min(take, 500))
            .orderBy('mat.sortOrder', 'ASC')
            .addOrderBy('mat.id', 'ASC');
        if (app !== undefined) {
            qb.where('mat.app = :app', { app });
        }
        return qb.getMany();
    }
    async findOneMaterial(ctx, id) {
        return this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial).findOne({ where: { id: id } });
    }
    /** (app, code) 唯一性服务层校验 */
    async assertCodeFree(ctx, app, code, excludeId) {
        const repo = this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial);
        const existing = await repo.findOne({ where: { app: app, code } });
        if (existing && (!excludeId || String(existing.id) !== String(excludeId))) {
            throw new core_1.UserInputError(`货号已存在: ${code}（app=${app !== null && app !== void 0 ? app : 'platform'}）`);
        }
    }
    async createMaterial(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        if (!input.code || !input.name || input.categoryId == null || !input.shape || input.price == null) {
            throw new core_1.UserInputError('code/name/categoryId/shape/price 为必填');
        }
        const app = (_a = input.app) !== null && _a !== void 0 ? _a : null;
        await this.assertCodeFree(ctx, app, input.code);
        const mat = new diy_material_entity_1.DiyMaterial({
            app,
            code: input.code,
            name: input.name,
            categoryId: input.categoryId,
            shape: input.shape,
            diameter: (_b = input.diameter) !== null && _b !== void 0 ? _b : null,
            axialLength: (_c = input.axialLength) !== null && _c !== void 0 ? _c : null,
            holeSize: (_d = input.holeSize) !== null && _d !== void 0 ? _d : null,
            attrs: (_e = input.attrs) !== null && _e !== void 0 ? _e : null,
            render: (_f = input.render) !== null && _f !== void 0 ? _f : null,
            price: Math.round(input.price),
            priceUnit: (_g = input.priceUnit) !== null && _g !== void 0 ? _g : 'piece',
            currency: (_h = input.currency) !== null && _h !== void 0 ? _h : 'CNY',
            stock: Math.round((_j = input.stock) !== null && _j !== void 0 ? _j : 0),
            images: (_k = input.images) !== null && _k !== void 0 ? _k : null,
            enabled: (_l = input.enabled) !== null && _l !== void 0 ? _l : true,
            sortOrder: (_m = input.sortOrder) !== null && _m !== void 0 ? _m : 0,
        });
        return this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial).save(mat);
    }
    async updateMaterial(ctx, input) {
        const repo = this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial);
        const mat = await repo.findOne({ where: { id: input.id } });
        if (!mat) {
            throw new core_1.UserInputError('素材不存在');
        }
        if (input.code !== undefined && input.code !== mat.code) {
            await this.assertCodeFree(ctx, mat.app, input.code, mat.id);
            mat.code = input.code;
        }
        if (input.name !== undefined)
            mat.name = input.name;
        if (input.categoryId !== undefined)
            mat.categoryId = input.categoryId;
        if (input.shape !== undefined)
            mat.shape = input.shape;
        if (input.diameter !== undefined)
            mat.diameter = input.diameter;
        if (input.axialLength !== undefined)
            mat.axialLength = input.axialLength;
        if (input.holeSize !== undefined)
            mat.holeSize = input.holeSize;
        if (input.attrs !== undefined)
            mat.attrs = input.attrs;
        if (input.render !== undefined)
            mat.render = input.render;
        if (input.price !== undefined)
            mat.price = Math.round(input.price);
        if (input.priceUnit !== undefined)
            mat.priceUnit = input.priceUnit;
        if (input.currency !== undefined)
            mat.currency = input.currency;
        if (input.stock !== undefined)
            mat.stock = Math.round(input.stock);
        if (input.images !== undefined)
            mat.images = input.images;
        if (input.enabled !== undefined)
            mat.enabled = input.enabled;
        if (input.sortOrder !== undefined)
            mat.sortOrder = input.sortOrder;
        return repo.save(mat);
    }
    async deleteMaterial(ctx, id) {
        const repo = this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial);
        const mat = await repo.findOne({ where: { id: id } });
        if (!mat) {
            return false;
        }
        await repo.remove(mat);
        return true;
    }
    /** 租户复制平台素材 = 完全接管价库存（sourceMaterialId 回链） */
    async copyMaterial(ctx, id) {
        var _a;
        const repo = this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial);
        const source = await repo.findOne({ where: { id: id } });
        if (!source) {
            throw new core_1.UserInputError('素材不存在');
        }
        if (source.app !== null) {
            throw new core_1.UserInputError('仅平台素材可复制为租户素材');
        }
        const tenantApp = (_a = this.options.app) !== null && _a !== void 0 ? _a : 'nshop';
        await this.assertCodeFree(ctx, tenantApp, source.code);
        const copy = new diy_material_entity_1.DiyMaterial(Object.assign(Object.assign({}, source), { id: undefined, app: tenantApp, sourceMaterialId: Number(source.id) }));
        return repo.save(copy);
    }
    /**
     * 批量导入/更新素材（首批珠子库 40+ 条走这里）。
     * input = { app?: string | null, items: DiyMaterialInput[] }；按 (app, code) upsert。
     * 返回处理条数。
     */
    async importMaterials(ctx, input) {
        var _a;
        if (!Array.isArray(input.items) || input.items.length === 0) {
            throw new core_1.UserInputError('items 不能为空');
        }
        const app = (_a = input.app) !== null && _a !== void 0 ? _a : null;
        const repo = this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial);
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            const txRepo = this.connection.getRepository(txCtx, diy_material_entity_1.DiyMaterial);
            let count = 0;
            for (const item of input.items) {
                if (!item.code) {
                    throw new core_1.UserInputError('导入项缺少 code');
                }
                const existing = await txRepo.findOne({ where: { app: app, code: item.code } });
                if (existing) {
                    if (item.name !== undefined)
                        existing.name = item.name;
                    if (item.categoryId !== undefined)
                        existing.categoryId = item.categoryId;
                    if (item.shape !== undefined)
                        existing.shape = item.shape;
                    if (item.diameter !== undefined)
                        existing.diameter = item.diameter;
                    if (item.axialLength !== undefined)
                        existing.axialLength = item.axialLength;
                    if (item.holeSize !== undefined)
                        existing.holeSize = item.holeSize;
                    if (item.attrs !== undefined)
                        existing.attrs = item.attrs;
                    if (item.render !== undefined)
                        existing.render = item.render;
                    if (item.price !== undefined)
                        existing.price = Math.round(item.price);
                    if (item.priceUnit !== undefined)
                        existing.priceUnit = item.priceUnit;
                    if (item.currency !== undefined)
                        existing.currency = item.currency;
                    if (item.stock !== undefined)
                        existing.stock = Math.round(item.stock);
                    if (item.images !== undefined)
                        existing.images = item.images;
                    if (item.enabled !== undefined)
                        existing.enabled = item.enabled;
                    if (item.sortOrder !== undefined)
                        existing.sortOrder = item.sortOrder;
                    await txRepo.save(existing);
                }
                else {
                    if (item.categoryId == null || !item.shape || item.price == null) {
                        throw new core_1.UserInputError(`新货号 ${item.code} 缺少 categoryId/shape/price`);
                    }
                    await txRepo.save(new diy_material_entity_1.DiyMaterial({
                        app,
                        code: item.code,
                        name: ((_a = item.name) !== null && _a !== void 0 ? _a : item.code),
                        categoryId: item.categoryId,
                        shape: item.shape,
                        diameter: (_b = item.diameter) !== null && _b !== void 0 ? _b : null,
                        axialLength: (_c = item.axialLength) !== null && _c !== void 0 ? _c : null,
                        holeSize: (_d = item.holeSize) !== null && _d !== void 0 ? _d : null,
                        attrs: (_e = item.attrs) !== null && _e !== void 0 ? _e : null,
                        render: (_f = item.render) !== null && _f !== void 0 ? _f : null,
                        price: Math.round(item.price),
                        priceUnit: (_g = item.priceUnit) !== null && _g !== void 0 ? _g : 'piece',
                        currency: (_h = item.currency) !== null && _h !== void 0 ? _h : 'CNY',
                        stock: Math.round((_j = item.stock) !== null && _j !== void 0 ? _j : 0),
                        images: (_k = item.images) !== null && _k !== void 0 ? _k : null,
                        enabled: (_l = item.enabled) !== null && _l !== void 0 ? _l : true,
                        sortOrder: (_m = item.sortOrder) !== null && _m !== void 0 ? _m : 0,
                    }));
                }
                count++;
            }
            core_1.Logger.info(`importMaterials app=${app !== null && app !== void 0 ? app : 'platform'} count=${count}`, constants_1.loggerCtx);
            return count;
        });
    }
    /* ------------------------------ 模板 ------------------------------ */
    async findTemplates(ctx, app) {
        const qb = this.connection
            .getRepository(ctx, diy_template_entity_1.DiyTemplate)
            .createQueryBuilder('tpl')
            .orderBy('tpl.sortOrder', 'ASC')
            .addOrderBy('tpl.id', 'ASC');
        if (app !== undefined) {
            qb.where('tpl.app = :app', { app });
        }
        return qb.getMany();
    }
    async findOneTemplate(ctx, id) {
        return this.connection.getRepository(ctx, diy_template_entity_1.DiyTemplate).findOne({ where: { id: id } });
    }
    async createTemplate(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!input.code || !input.name || !input.config) {
            throw new core_1.UserInputError('code/name/config 为必填');
        }
        const app = (_a = input.app) !== null && _a !== void 0 ? _a : null;
        const repo = this.connection.getRepository(ctx, diy_template_entity_1.DiyTemplate);
        const dup = await repo.findOne({ where: { app: app, code: input.code } });
        if (dup) {
            throw new core_1.UserInputError(`模板 code 已存在: ${input.code}（app=${app !== null && app !== void 0 ? app : 'platform'}）`);
        }
        const config = input.config;
        return repo.save(new diy_template_entity_1.DiyTemplate({
            app,
            code: input.code,
            name: input.name,
            description: (_b = input.description) !== null && _b !== void 0 ? _b : null,
            thumb: (_c = input.thumb) !== null && _c !== void 0 ? _c : null,
            images: (_d = input.images) !== null && _d !== void 0 ? _d : null,
            config,
            calculatorKey: (_e = input.calculatorKey) !== null && _e !== void 0 ? _e : null,
            status: (_f = input.status) !== null && _f !== void 0 ? _f : 'draft',
            sortOrder: (_g = input.sortOrder) !== null && _g !== void 0 ? _g : 0,
        }));
    }
    async updateTemplate(ctx, input) {
        const repo = this.connection.getRepository(ctx, diy_template_entity_1.DiyTemplate);
        const tpl = await repo.findOne({ where: { id: input.id } });
        if (!tpl) {
            throw new core_1.UserInputError('模板不存在');
        }
        if (input.code !== undefined)
            tpl.code = input.code;
        if (input.name !== undefined)
            tpl.name = input.name;
        if (input.description !== undefined)
            tpl.description = input.description;
        if (input.thumb !== undefined)
            tpl.thumb = input.thumb;
        if (input.images !== undefined)
            tpl.images = input.images;
        if (input.config !== undefined)
            tpl.config = input.config;
        if (input.calculatorKey !== undefined)
            tpl.calculatorKey = input.calculatorKey;
        if (input.status !== undefined)
            tpl.status = input.status;
        if (input.sortOrder !== undefined)
            tpl.sortOrder = input.sortOrder;
        return repo.save(tpl);
    }
    async deleteTemplate(ctx, id) {
        const repo = this.connection.getRepository(ctx, diy_template_entity_1.DiyTemplate);
        const tpl = await repo.findOne({ where: { id: id } });
        if (!tpl) {
            return false;
        }
        await repo.remove(tpl);
        return true;
    }
    /** 发布：status → enabled 且 version+1（规格 §5.1） */
    async publishTemplate(ctx, id) {
        var _a;
        const repo = this.connection.getRepository(ctx, diy_template_entity_1.DiyTemplate);
        const tpl = await repo.findOne({ where: { id: id } });
        if (!tpl) {
            throw new core_1.UserInputError('模板不存在');
        }
        tpl.status = 'enabled';
        tpl.version = ((_a = tpl.version) !== null && _a !== void 0 ? _a : 1) + 1;
        return repo.save(tpl);
    }
    /** 租户复制平台模板改配置（同素材库哲学） */
    async copyTemplate(ctx, id) {
        var _a;
        const repo = this.connection.getRepository(ctx, diy_template_entity_1.DiyTemplate);
        const source = await repo.findOne({ where: { id: id } });
        if (!source) {
            throw new core_1.UserInputError('模板不存在');
        }
        if (source.app !== null) {
            throw new core_1.UserInputError('仅平台模板可复制为租户模板');
        }
        const tenantApp = (_a = this.options.app) !== null && _a !== void 0 ? _a : 'nshop';
        const dup = await repo.findOne({ where: { app: tenantApp, code: source.code } });
        if (dup) {
            throw new core_1.UserInputError(`租户模板 code 已存在: ${source.code}`);
        }
        return repo.save(new diy_template_entity_1.DiyTemplate(Object.assign(Object.assign({}, source), { id: undefined, app: tenantApp })));
    }
    /* ------------------------------ 方案 ------------------------------ */
    /** admin 方案列表（规格 §7 admin 面）；app 不传 = 全部租户端 */
    async findPlans(ctx, options = {}) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, diy_plan_entity_1.DiyPlan);
        const where = {};
        if (options.app !== undefined) {
            where.app = options.app;
        }
        if (options.status) {
            where.status = options.status;
        }
        const [items, total] = await repo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: (_a = options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, total };
    }
};
exports.DiyService = DiyService;
exports.DiyService = DiyService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, Object])
], DiyService);
//# sourceMappingURL=diy.service.js.map