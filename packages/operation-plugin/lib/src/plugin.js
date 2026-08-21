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
var OperationPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const operation_admin_resolver_1 = require("./operation-admin.resolver");
const operation_section_entity_1 = require("./operation-section.entity");
const operation_item_entity_1 = require("./operation-item.entity");
const operation_service_1 = require("./operation.service");
const operation_shop_resolver_1 = require("./operation-shop.resolver");
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
    type OperationItem {
        id: ID!
        type: String!
        sortOrder: Int!
        title: String
        imageAssetId: ID
        linkUrl: String
        productId: ID
    }

    type OperationSection implements Node {
        id: ID!
        code: String!
        name: String!
        type: String!
        displayMode: String
        enabled: Boolean!
        position: Int!
        items: [OperationItem!]!
    }

    input OperationListOptions {
        skip: Int
        take: Int
    }

    input CreateOperationSectionInput {
        code: String!
        name: String!
        type: String!
        displayMode: String
        position: Int
        enabled: Boolean
    }

    input UpdateOperationSectionInput {
        name: String
        type: String
        displayMode: String
        position: Int
        enabled: Boolean
    }

    input OperationItemInput {
        type: String!
        sortOrder: Int!
        title: String
        imageAssetId: ID
        linkUrl: String
        productId: ID
    }

    extend type Query {
        operationSections(options: OperationListOptions): [OperationSection!]!
        operationSection(code: String!): OperationSection
    }

    extend type Mutation {
        createOperationSection(input: CreateOperationSectionInput!): OperationSection!
        updateOperationSection(id: ID!, input: UpdateOperationSectionInput!): OperationSection!
        deleteOperationSection(id: ID!): Boolean!
        setOperationItems(sectionId: ID!, items: [OperationItemInput!]!): [OperationItem!]!
    }
`;
const shopSchema = () => gql `
    type OperationItem {
        id: ID!
        type: String!
        sortOrder: Int!
        title: String
        imageUrl: String
        linkUrl: String
        product: Product
    }

    type OperationSection implements Node {
        id: ID!
        code: String!
        name: String!
        type: String!
        displayMode: String
        position: Int!
        items: [OperationItem!]!
    }

    input OperationListOptions {
        skip: Int
        take: Int
    }

    extend type Query {
        operationSections(options: OperationListOptions): [OperationSection!]!
        operationSection(code: String!): OperationSection
    }
`;
let OperationPlugin = OperationPlugin_1 = class OperationPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        OperationPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return OperationPlugin_1;
    }
};
exports.OperationPlugin = OperationPlugin;
OperationPlugin.options = {};
exports.OperationPlugin = OperationPlugin = OperationPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [operation_section_entity_1.OperationSection, operation_item_entity_1.OperationItem],
        providers: [
            { provide: constants_1.OPERATION_PLUGIN_OPTIONS, useFactory: () => OperationPlugin.options },
            operation_service_1.OperationService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [operation_admin_resolver_1.OperationAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [operation_shop_resolver_1.OperationShopResolver],
        },
        configuration: (config) => config,
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.OPERATION_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], OperationPlugin);
//# sourceMappingURL=plugin.js.map