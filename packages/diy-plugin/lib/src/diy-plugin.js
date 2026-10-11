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
var DiyPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiyPlugin = exports.DiySeedRunner = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const diy_admin_resolver_1 = require("./diy-admin.resolver");
const diy_service_1 = require("./diy.service");
const diy_shop_resolver_1 = require("./diy-shop.resolver");
const diy_shop_service_1 = require("./diy-shop.service");
const diy_category_entity_1 = require("./entities/diy-category.entity");
const diy_material_entity_1 = require("./entities/diy-material.entity");
const diy_plan_entity_1 = require("./entities/diy-plan.entity");
const diy_template_entity_1 = require("./entities/diy-template.entity");
const permissions_1 = require("./permissions");
const seed_1 = require("./seed");
const adminSchema = (0, graphql_tag_1.default) `
    type DiyCategory implements Node {
        id: ID!
        app: String
        code: String
        parentId: Int
        name: JSON
        image: String
        sortOrder: Int!
        enabled: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyMaterial implements Node {
        id: ID!
        app: String
        code: String!
        name: JSON
        categoryId: Int!
        shape: String!
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int!
        priceUnit: String!
        currency: String!
        stock: Int!
        images: JSON
        sourceMaterialId: Int
        enabled: Boolean!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyTemplate implements Node {
        id: ID!
        app: String
        code: String!
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String!
        version: Int!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    input DiyCategoryInput {
        id: ID
        app: String
        code: String
        parentId: Int
        name: JSON
        image: String
        sortOrder: Int
        enabled: Boolean
    }
    input DiyMaterialInput {
        id: ID
        app: String
        code: String
        name: JSON
        categoryId: Int
        shape: String
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int
        priceUnit: String
        currency: String
        stock: Int
        images: JSON
        enabled: Boolean
        sortOrder: Int
    }
    input DiyTemplateInput {
        id: ID
        app: String
        code: String
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String
        sortOrder: Int
    }
    extend type Query {
        diyCategories(app: String): [DiyCategory!]!
        diyCategory(id: ID!): DiyCategory
        diyMaterials(app: String, skip: Int, take: Int): [DiyMaterial!]!
        diyMaterial(id: ID!): DiyMaterial
        diyTemplates(app: String): [DiyTemplate!]!
        diyTemplate(id: ID!): DiyTemplate
    }
    extend type Mutation {
        createDiyCategory(input: DiyCategoryInput!): DiyCategory!
        updateDiyCategory(input: DiyCategoryInput!): DiyCategory!
        deleteDiyCategory(id: ID!): Boolean!
        createDiyMaterial(input: DiyMaterialInput!): DiyMaterial!
        updateDiyMaterial(input: DiyMaterialInput!): DiyMaterial!
        deleteDiyMaterial(id: ID!): Boolean!
        copyDiyMaterial(id: ID!): DiyMaterial!
        diyMaterialsImport(input: JSON!): Int!
        createDiyTemplate(input: DiyTemplateInput!): DiyTemplate!
        updateDiyTemplate(input: DiyTemplateInput!): DiyTemplate!
        deleteDiyTemplate(id: ID!): Boolean!
        publishDiyTemplate(id: ID!): DiyTemplate!
        copyDiyTemplate(id: ID!): DiyTemplate!
    }
`;
const shopSchema = (0, graphql_tag_1.default) `
    type DiyMaterial {
        id: ID!
        app: String
        code: String!
        name: JSON
        categoryId: Int!
        shape: String!
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int!
        priceUnit: String!
        currency: String!
        stock: Int!
        images: JSON
        enabled: Boolean!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyMaterialList {
        items: [DiyMaterial!]!
        total: Int!
    }
    type DiyTemplate {
        id: ID!
        app: String
        code: String!
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String!
        version: Int!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    extend type Query {
        diyMaterials(filter: JSON): DiyMaterialList!
        diyShopTemplates: [DiyTemplate!]!
        diyShopTemplate(code: String!): DiyTemplate
    }
    type DiyPlan {
        id: ID!
        status: String!
        spec: JSON
        bom: JSON
        calcVersion: String!
        quoteNo: String
        expiresAt: DateTime
        orderLineId: Int
        thumb: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyPlanList {
        items: [DiyPlan!]!
        total: Int!
    }
    extend type Query {
        myDiyPlans(status: String, skip: Int, take: Int): DiyPlanList!
        myDiyPlan(id: ID!): DiyPlan
    }
    extend type Mutation {
        createDiyPlan(templateCode: String!, spec: JSON!, thumb: String): DiyPlan!
        quoteDiyPlan(id: ID!): DiyPlan!
    }
`;
let DiySeedRunner = class DiySeedRunner {
    constructor(connection) {
        this.connection = connection;
    }
    async run() {
        await (0, seed_1.seedDiy)(this.connection);
    }
};
exports.DiySeedRunner = DiySeedRunner;
exports.DiySeedRunner = DiySeedRunner = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], DiySeedRunner);
let DiyPlugin = DiyPlugin_1 = class DiyPlugin {
    static init(options) {
        DiyPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return DiyPlugin_1;
    }
    constructor(options, seedRunner) {
        this.options = options;
        this.seedRunner = seedRunner;
    }
    async onApplicationBootstrap() {
        await this.seedRunner.run();
        core_1.Logger.info('DiyPlugin initialized', constants_1.loggerCtx);
    }
};
exports.DiyPlugin = DiyPlugin;
DiyPlugin.options = {};
exports.DiyPlugin = DiyPlugin = DiyPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [diy_category_entity_1.DiyCategory, diy_material_entity_1.DiyMaterial, diy_template_entity_1.DiyTemplate, diy_plan_entity_1.DiyPlan],
        providers: [
            { provide: constants_1.PLUGIN_INIT_OPTIONS, useFactory: () => DiyPlugin.options },
            diy_service_1.DiyService,
            diy_shop_service_1.DiyShopService,
            DiySeedRunner,
        ],
        exports: [diy_service_1.DiyService],
        adminApiExtensions: {
            schema: () => adminSchema,
            resolvers: [diy_admin_resolver_1.DiyAdminResolver],
        },
        shopApiExtensions: {
            schema: () => shopSchema,
            resolvers: [diy_shop_resolver_1.DiyShopResolver],
        },
        configuration: config => {
            config.authOptions.customPermissions.push(permissions_1.DiyRead, permissions_1.DiyCreate, permissions_1.DiyUpdate, permissions_1.DiyDelete);
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata("design:paramtypes", [Object, DiySeedRunner])
], DiyPlugin);
//# sourceMappingURL=diy-plugin.js.map