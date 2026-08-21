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
var FavoritePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoritePlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const favorite_entity_1 = require("./favorite.entity");
const favorite_custom_fields_1 = require("./favorite-custom-fields");
const favorite_service_1 = require("./favorite.service");
const favorite_resolver_1 = require("./favorite.resolver");
const { gql } = require('graphql-tag');
/** 幂等并入自定义字段，按 name 去重（preBootstrapConfig 可能多次执行插件配置）。 */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const shopSchema = () => gql `
    extend type Query {
        myFavoriteProducts: [Product!]!
        myFollowedShops: [Shop!]!
        isProductFavorite(productId: ID!): Boolean!
        isShopFollowed(shopId: ID!): Boolean!
        shopFollowerCount(shopId: ID!): Int!
    }

    extend type Mutation {
        toggleFavoriteProduct(productId: ID!): Boolean!
        toggleFollowShop(shopId: ID!): Boolean!
    }
`;
let FavoritePlugin = FavoritePlugin_1 = class FavoritePlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        FavoritePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return FavoritePlugin_1;
    }
};
exports.FavoritePlugin = FavoritePlugin;
FavoritePlugin.options = {};
exports.FavoritePlugin = FavoritePlugin = FavoritePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [favorite_entity_1.Favorite],
        providers: [
            { provide: constants_1.FAVORITE_PLUGIN_OPTIONS, useFactory: () => FavoritePlugin.options },
            favorite_service_1.FavoriteService,
        ],
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [favorite_resolver_1.FavoriteShopResolver],
        },
        configuration: (config) => {
            // 商品收藏数快照写入 Product 自定义字段
            config.customFields.Product = mergeCustomFields(config.customFields.Product, favorite_custom_fields_1.favoriteCustomFields.Product);
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.FAVORITE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], FavoritePlugin);
//# sourceMappingURL=plugin.js.map