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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopTemplateService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shop_template_entity_1 = require("./shop-template.entity");
const shop_global_config_entity_1 = require("./shop-global-config.entity");
const shop_template_version_entity_1 = require("./shop-template-version.entity");
const merge_config_1 = require("./merge-config");
let ShopTemplateService = class ShopTemplateService {
    constructor(connection) {
        this.connection = connection;
    }
    /* --------------------- 模板管理 --------------------- */
    /** 管理端：列表（可选按 app 过滤，含停用模板） */
    async findAll(ctx, app) {
        const qb = this.connection.getRepository(ctx, shop_template_entity_1.ShopTemplate).createQueryBuilder('tpl');
        if (app) {
            qb.andWhere('tpl.app = :app', { app });
        }
        return qb.orderBy('tpl.updatedAt', 'DESC').getMany();
    }
    /** 管理端：单个模板 */
    async findOne(ctx, id) {
        return this.connection.getRepository(ctx, shop_template_entity_1.ShopTemplate).findOne({ where: { id: id } });
    }
    /** 管理端：创建（app 必填且合法） */
    async create(ctx, input) {
        var _a, _b, _c;
        if (input.app !== 'nshop' && input.app !== 'vshop') {
            throw new core_1.UserInputError('app 必须为 nshop 或 vshop');
        }
        const tpl = new shop_template_entity_1.ShopTemplate({
            name: input.name,
            app: input.app,
            theme: (_a = input.theme) !== null && _a !== void 0 ? _a : {},
            pages: (_b = input.pages) !== null && _b !== void 0 ? _b : {},
            version: 1,
            enabled: (_c = input.enabled) !== null && _c !== void 0 ? _c : true,
        });
        return this.connection.getRepository(ctx, shop_template_entity_1.ShopTemplate).save(tpl);
    }
    /** 管理端：更新（不允许改 app） */
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, shop_template_entity_1.ShopTemplate);
        const tpl = await repo.findOne({ where: { id: input.id } });
        if (!tpl) {
            throw new core_1.UserInputError('模板不存在');
        }
        // 保存前写快照（此时 tpl 仍为旧值）
        await this.snapshot(ctx, tpl, '更新前快照');
        if (input.name !== undefined)
            tpl.name = input.name;
        if (input.theme !== undefined)
            tpl.theme = input.theme;
        if (input.pages !== undefined)
            tpl.pages = input.pages;
        if (input.enabled !== undefined)
            tpl.enabled = input.enabled;
        return repo.save(tpl);
    }
    /** 管理端：删除 */
    async delete(ctx, id) {
        const repo = this.connection.getRepository(ctx, shop_template_entity_1.ShopTemplate);
        const tpl = await repo.findOne({ where: { id: id } });
        if (!tpl) {
            return false;
        }
        await repo.remove(tpl);
        return true;
    }
    /** 管理端：复制为新模板（name 加「副本」，version+1，enabled 继承） */
    async copy(ctx, id) {
        var _a, _b, _c;
        const tpl = await this.findOne(ctx, id);
        if (!tpl) {
            throw new core_1.UserInputError('模板不存在');
        }
        const copy = new shop_template_entity_1.ShopTemplate({
            name: `${tpl.name} 副本`,
            app: tpl.app,
            theme: (_a = tpl.theme) !== null && _a !== void 0 ? _a : {},
            pages: (_b = tpl.pages) !== null && _b !== void 0 ? _b : {},
            version: ((_c = tpl.version) !== null && _c !== void 0 ? _c : 1) + 1,
            enabled: tpl.enabled,
        });
        return this.connection.getRepository(ctx, shop_template_entity_1.ShopTemplate).save(copy);
    }
    /** C 端：优先取店铺引用模板（显式 id → 当前渠道 channel.customFields.templateId），
     *  未引用/引用无效（跨端、已停用）时返回 null，C 端回退 L1 全局默认（手册「不使用模板 = 全局默认」） */
    async shopTemplate(ctx, app, id) {
        var _a, _b, _c;
        const repo = this.connection.getRepository(ctx, shop_template_entity_1.ShopTemplate);
        const refId = id !== null && id !== void 0 ? id : ((_c = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.templateId) !== null && _c !== void 0 ? _c : undefined);
        if (refId) {
            const tpl = await repo.findOne({ where: { id: refId } });
            // 引用跨端/已停用模板时回退，避免 C 端拿到不可用配置
            if (!tpl || tpl.app !== app || !tpl.enabled) {
                return null;
            }
            return tpl;
        }
        return null;
    }
    /* --------------------- 全局配置 --------------------- */
    async findGlobalConfig(ctx, app) {
        return this.connection.getRepository(ctx, shop_global_config_entity_1.ShopGlobalConfig).findOne({ where: { app } });
    }
    /** 管理端：更新全局配置（upsert：无记录则创建） */
    async upsertGlobalConfig(ctx, input) {
        if (input.app !== 'nshop' && input.app !== 'vshop') {
            throw new core_1.UserInputError('app 必须为 nshop 或 vshop');
        }
        const repo = this.connection.getRepository(ctx, shop_global_config_entity_1.ShopGlobalConfig);
        let cfg = await repo.findOne({ where: { app: input.app } });
        if (!cfg) {
            cfg = new shop_global_config_entity_1.ShopGlobalConfig({ app: input.app });
        }
        if (input.themeTokens !== undefined)
            cfg.themeTokens = input.themeTokens;
        if (input.defaults !== undefined)
            cfg.defaults = input.defaults;
        return repo.save(cfg);
    }
    /* --------------------- 版本快照 / 回滚 / 引用 / 合并预览 --------------------- */
    versionRepo(ctx) {
        return this.connection.getRepository(ctx, shop_template_version_entity_1.ShopTemplateVersion);
    }
    /** 写快照（保存前调用：把旧值入版本表） */
    async snapshot(ctx, tpl, note) {
        var _a, _b, _c, _d;
        const v = new shop_template_version_entity_1.ShopTemplateVersion({
            templateId: Number(tpl.id),
            version: (_a = tpl.version) !== null && _a !== void 0 ? _a : 1,
            name: tpl.name,
            theme: (_b = tpl.theme) !== null && _b !== void 0 ? _b : {},
            pages: (_c = tpl.pages) !== null && _c !== void 0 ? _c : {},
            enabled: (_d = tpl.enabled) !== null && _d !== void 0 ? _d : true,
            note,
        });
        await this.versionRepo(ctx).save(v);
    }
    /** 版本历史 */
    async versions(ctx, id) {
        return this.versionRepo(ctx).find({ where: { templateId: Number(id) }, order: { version: 'DESC' } });
    }
    /** 回滚：当前值入快照 → 目标版本写回 → version+1 */
    async restore(ctx, id, version) {
        var _a, _b, _c, _d, _e;
        const repo = this.connection.getRepository(ctx, shop_template_entity_1.ShopTemplate);
        const tpl = await repo.findOne({ where: { id: id } });
        if (!tpl)
            throw new core_1.UserInputError('模板不存在');
        const snap = await this.versionRepo(ctx).findOne({ where: { templateId: Number(id), version } });
        if (!snap)
            throw new core_1.UserInputError(`版本 ${version} 不存在`);
        await this.snapshot(ctx, tpl, `回滚前备份 v${tpl.version}`);
        tpl.name = (_a = snap.name) !== null && _a !== void 0 ? _a : tpl.name;
        tpl.theme = (_b = snap.theme) !== null && _b !== void 0 ? _b : {};
        tpl.pages = (_c = snap.pages) !== null && _c !== void 0 ? _c : {};
        tpl.enabled = (_d = snap.enabled) !== null && _d !== void 0 ? _d : true;
        tpl.version = ((_e = tpl.version) !== null && _e !== void 0 ? _e : 1) + 1;
        return repo.save(tpl);
    }
    /** 引用查询：哪些渠道引用了该模板（channel.customFields.templateId == id） */
    async references(ctx, id) {
        const channels = await this.connection.getRepository(ctx, core_1.Channel).find({ loadEagerRelations: false });
        const idStr = String(id);
        return channels
            .filter((c) => { var _a, _b; return String((_b = (_a = c.customFields) === null || _a === void 0 ? void 0 : _a.templateId) !== null && _b !== void 0 ? _b : '') === idStr; })
            .map((c) => {
            var _a, _b, _c, _d;
            return ({
                channelId: String(c.id),
                channelCode: c.code,
                channelName: (_b = (_a = c.customFields) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : c.code,
                app: (_d = (_c = c.customFields) === null || _c === void 0 ? void 0 : _c.app) !== null && _d !== void 0 ? _d : '',
            });
        });
    }
    /** 合并预览：L1 → L2 → L3 深合并，返回 merged + sourceByKey */
    async mergedPreview(ctx, app, templateId, overrides) {
        var _a, _b, _c, _d;
        const cfg = await this.findGlobalConfig(ctx, app);
        const tpl = templateId ? await this.findOne(ctx, templateId) : null;
        const l1 = Object.assign(Object.assign({}, ((_a = cfg === null || cfg === void 0 ? void 0 : cfg.themeTokens) !== null && _a !== void 0 ? _a : {})), ((_b = cfg === null || cfg === void 0 ? void 0 : cfg.defaults) !== null && _b !== void 0 ? _b : {}));
        const l2 = tpl ? Object.assign(Object.assign({}, ((_c = tpl.theme) !== null && _c !== void 0 ? _c : {})), ((_d = tpl.pages) !== null && _d !== void 0 ? _d : {})) : {};
        return (0, merge_config_1.mergePreview)(l1, l2, overrides !== null && overrides !== void 0 ? overrides : {});
    }
};
exports.ShopTemplateService = ShopTemplateService;
exports.ShopTemplateService = ShopTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], ShopTemplateService);
//# sourceMappingURL=shop-template.service.js.map