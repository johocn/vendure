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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ShopTemplatePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopTemplatePlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const shop_template_admin_resolver_1 = require("./shop-template-admin.resolver");
const shop_template_shop_resolver_1 = require("./shop-template-shop.resolver");
const shop_template_service_1 = require("./shop-template.service");
const shop_template_entity_1 = require("./shop-template.entity");
const shop_global_config_entity_1 = require("./shop-global-config.entity");
const permissions_1 = require("./permissions");
/** 幂等合并 customFields（预构建钩子可能多次执行） */
function mergeCustomFields(existing, additions) {
    const names = new Set((existing !== null && existing !== void 0 ? existing : []).map(f => f.name));
    return [...(existing !== null && existing !== void 0 ? existing : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const templateType = `
type ShopTemplate implements Node {
    id: ID!
    name: String!
    app: String!
    theme: JSON
    pages: JSON
    version: Int!
    enabled: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
}
type ShopGlobalConfig implements Node {
    id: ID!
    app: String!
    themeTokens: JSON
    defaults: JSON
}
input CreateShopTemplateInput {
    name: String!
    app: String!
    theme: JSON
    pages: JSON
    enabled: Boolean
}
input UpdateShopTemplateInput {
    id: ID!
    name: String
    theme: JSON
    pages: JSON
    enabled: Boolean
}
input UpdateShopGlobalConfigInput {
    app: String!
    themeTokens: JSON
    defaults: JSON
}
`;
const SEED_TEMPLATES = [
    {
        name: '橙色经典',
        theme: { primaryColor: '#ff6600', accentColor: '#fff3e6', radius: 8 },
        pages: {},
    },
    {
        name: '生鲜绿',
        theme: { primaryColor: '#07c160', accentColor: '#e6f7ee', radius: 8 },
        pages: {},
    },
    {
        name: '深色科技',
        theme: { primaryColor: '#1a1a1a', accentColor: '#333333', radius: 8 },
        pages: {},
    },
];
let ShopTemplatePlugin = ShopTemplatePlugin_1 = class ShopTemplatePlugin {
    constructor(options, moduleRef) {
        this.options = options;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        ShopTemplatePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return ShopTemplatePlugin_1;
    }
    async onApplicationBootstrap() {
        const injector = new core_2.Injector(this.moduleRef);
        this.connection = injector.get(core_2.TransactionalConnection);
        await this.seed();
        core_2.Logger.info('ShopTemplatePlugin initialized', constants_1.loggerCtx);
    }
    /** 空库种子：3 套模板 × 双端 + 全局配置 2 条（幂等） */
    async seed() {
        try {
            const tplRepo = this.connection.getRepository(shop_template_entity_1.ShopTemplate);
            const cfgRepo = this.connection.getRepository(shop_global_config_entity_1.ShopGlobalConfig);
            for (const app of ['nshop', 'vshop']) {
                const existing = await tplRepo.find({ where: { app } });
                if (existing.length === 0) {
                    for (const t of SEED_TEMPLATES) {
                        await tplRepo.save(new shop_template_entity_1.ShopTemplate(Object.assign(Object.assign({}, t), { app, version: 1, enabled: true })));
                    }
                    core_2.Logger.info(`[ShopTemplatePlugin] seeded ${app} templates`, constants_1.loggerCtx);
                }
                const cfg = await cfgRepo.findOne({ where: { app } });
                if (!cfg) {
                    await cfgRepo.save(new shop_global_config_entity_1.ShopGlobalConfig({
                        app,
                        themeTokens: {
                            primaryColor: '#ff6600',
                            accentColor: '#fff3e6',
                            radius: 8,
                        },
                        defaults: {},
                    }));
                    core_2.Logger.info(`[ShopTemplatePlugin] seeded ${app} global config`, constants_1.loggerCtx);
                }
            }
        }
        catch (e) {
            core_2.Logger.error(`[ShopTemplatePlugin] seed 失败: ${e.message}`, constants_1.loggerCtx);
        }
    }
};
exports.ShopTemplatePlugin = ShopTemplatePlugin;
ShopTemplatePlugin.options = {};
exports.ShopTemplatePlugin = ShopTemplatePlugin = ShopTemplatePlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [shop_template_entity_1.ShopTemplate, shop_global_config_entity_1.ShopGlobalConfig],
        providers: [
            { provide: constants_1.PLUGIN_INIT_OPTIONS, useFactory: () => ShopTemplatePlugin.options },
            shop_template_service_1.ShopTemplateService,
        ],
        exports: [shop_template_service_1.ShopTemplateService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            ${templateType}
            extend type Query {
                shopTemplates(app: String): [ShopTemplate!]!
                shopTemplate(id: ID!): ShopTemplate
                shopGlobalConfig(app: String!): ShopGlobalConfig
            }
            extend type Mutation {
                createShopTemplate(input: CreateShopTemplateInput!): ShopTemplate!
                updateShopTemplate(input: UpdateShopTemplateInput!): ShopTemplate!
                deleteShopTemplate(id: ID!): Boolean!
                copyShopTemplate(id: ID!): ShopTemplate!
                updateShopGlobalConfig(input: UpdateShopGlobalConfigInput!): ShopGlobalConfig!
            }
        `,
            resolvers: [shop_template_admin_resolver_1.ShopTemplateAdminResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            ${templateType}
            extend type Query {
                shopTemplate(app: String!, id: ID): ShopTemplate
                shopGlobalConfig(app: String!): ShopGlobalConfig
            }
        `,
            resolvers: [shop_template_shop_resolver_1.ShopTemplateShopResolver],
        },
        configuration: (config) => {
            // 注册自定义权限（必须 push 到 customPermissions，Permission 枚举才会包含）
            config.authOptions.customPermissions.push(permissions_1.shopTemplatesRead, permissions_1.shopTemplatesCreate, permissions_1.shopTemplatesUpdate, permissions_1.shopTemplatesDelete);
            // 店铺「选模板」引用字段（与既有店铺装修字段并存）
            config.customFields.Channel = mergeCustomFields(config.customFields.Channel, [
                { name: 'templateId', type: 'string', public: true },
            ]);
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.ModuleRef])
], ShopTemplatePlugin);
//# sourceMappingURL=plugin.js.map