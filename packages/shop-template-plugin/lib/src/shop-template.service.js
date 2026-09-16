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
};
exports.ShopTemplateService = ShopTemplateService;
exports.ShopTemplateService = ShopTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], ShopTemplateService);
//# sourceMappingURL=shop-template.service.js.map