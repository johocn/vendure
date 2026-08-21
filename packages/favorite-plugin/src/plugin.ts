import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { FAVORITE_PLUGIN_OPTIONS } from './constants';
import { Favorite } from './favorite.entity';
import { favoriteCustomFields } from './favorite-custom-fields';
import { FavoriteService } from './favorite.service';
import { FavoriteShopResolver } from './favorite.resolver';
import { FavoritePluginOptions } from './types';

const { gql } = require('graphql-tag');

/** 幂等并入自定义字段，按 name 去重（preBootstrapConfig 可能多次执行插件配置）。 */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const shopSchema = () => gql`
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

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Favorite],
    providers: [
        { provide: FAVORITE_PLUGIN_OPTIONS, useFactory: () => FavoritePlugin.options },
        FavoriteService,
    ],
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [FavoriteShopResolver],
    },
    configuration: (config) => {
        // 商品收藏数快照写入 Product 自定义字段
        config.customFields.Product = mergeCustomFields(
            config.customFields.Product,
            favoriteCustomFields.Product,
        );
        return config;
    },
    compatibility: '^3.0.0',
})
export class FavoritePlugin {
    private static options: FavoritePluginOptions = {};

    constructor(@Inject(FAVORITE_PLUGIN_OPTIONS) private options: FavoritePluginOptions) {}

    static init(options?: FavoritePluginOptions): Type<FavoritePlugin> {
        FavoritePlugin.options = options ?? {};
        return FavoritePlugin;
    }
}