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
var ShopPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const shop_entity_1 = require("./shop.entity");
const shop_admin_resolver_1 = require("./shop-admin.resolver");
const shop_custom_fields_1 = require("./shop-custom-fields");
const shop_service_1 = require("./shop.service");
const shop_shop_resolver_1 = require("./shop-shop.resolver");
const { gql } = require('graphql-tag');
/** 幂等并入自定义字段，按 name 去重（preBootstrapConfig 可能多次执行插件配置）。 */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const adminSchema = () => gql `
    type Shop implements Node {
        id: ID!
        name: String!
        slug: String!
        logoAssetId: ID
        bannerAssetId: ID
        description: String
        status: String!
        ownerId: ID
        rating: ShopRating!
        productCount: Int!
        products(options: ShopListOptions): ProductList!
    }

    type ShopRating {
        rating: Float!
        reviewCount: Int!
        productCount: Int!
    }

    input ShopListOptions {
        skip: Int
        take: Int
    }

    input CreateShopInput {
        name: String!
        slug: String!
        logoAssetId: ID
        bannerAssetId: ID
        description: String
    }

    input UpdateShopInput {
        name: String
        slug: String
        logoAssetId: ID
        bannerAssetId: ID
        description: String
    }

    input AssignProductsInput {
        shopId: ID!
        productIds: [ID!]!
    }

    extend type Query {
        shops(options: ShopListOptions): [Shop!]!
        shopById(id: ID!): Shop
    }

    extend type Mutation {
        createShop(input: CreateShopInput!): Shop!
        updateShop(id: ID!, input: UpdateShopInput!): Shop!
        setShopStatus(id: ID!, status: String!): Shop!
        assignProductsToShop(input: AssignProductsInput!): Boolean!
        unassignProductsFromShop(input: AssignProductsInput!): Boolean!
        recomputeShopRating(id: ID!): Shop!
    }
`;
const shopSchema = () => gql `
    type Shop implements Node {
        id: ID!
        name: String!
        slug: String!
        logoAssetId: ID
        bannerAssetId: ID
        description: String
        status: String!
        rating: ShopRating!
        productCount: Int!
        products(options: ShopListOptions): ProductList!
    }

    type ShopRating {
        rating: Float!
        reviewCount: Int!
        productCount: Int!
    }

    input ShopListOptions {
        skip: Int
        take: Int
    }

    extend type Query {
        shops(options: ShopListOptions): [Shop!]!
        shop(slug: String!): Shop
    }
`;
let ShopPlugin = ShopPlugin_1 = class ShopPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        ShopPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return ShopPlugin_1;
    }
};
exports.ShopPlugin = ShopPlugin;
ShopPlugin.options = {};
exports.ShopPlugin = ShopPlugin = ShopPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [shop_entity_1.Shop],
        providers: [
            { provide: constants_1.SHOP_PLUGIN_OPTIONS, useFactory: () => ShopPlugin.options },
            shop_service_1.ShopService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [shop_admin_resolver_1.ShopAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [shop_shop_resolver_1.ShopShopResolver],
        },
        configuration: (config) => {
            // 商品归属店铺：Product.shopId（int, nullable, public）
            config.customFields.Product = mergeCustomFields(config.customFields.Product, shop_custom_fields_1.shopCustomFields.Product);
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.SHOP_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], ShopPlugin);
//# sourceMappingURL=plugin.js.map