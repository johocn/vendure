import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { SHOP_PLUGIN_OPTIONS } from './constants';
import { Shop } from './shop.entity';
import { ShopAdminResolver } from './shop-admin.resolver';
import { shopCustomFields } from './shop-custom-fields';
import { ShopService } from './shop.service';
import { ShopShopResolver } from './shop-shop.resolver';
import { ShopPluginOptions } from './types';

const { gql } = require('graphql-tag');

/** 幂等并入自定义字段，按 name 去重（preBootstrapConfig 可能多次执行插件配置）。 */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const adminSchema = () => gql`
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

const shopSchema = () => gql`
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

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Shop],
    providers: [
        { provide: SHOP_PLUGIN_OPTIONS, useFactory: () => ShopPlugin.options },
        ShopService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [ShopAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [ShopShopResolver],
    },
    configuration: (config) => {
        // 商品归属店铺：Product.shopId（int, nullable, public）
        config.customFields.Product = mergeCustomFields(
            config.customFields.Product,
            shopCustomFields.Product,
        );
        return config;
    },
    compatibility: '^3.0.0',
})
export class ShopPlugin {
    private static options: ShopPluginOptions = {};

    constructor(@Inject(SHOP_PLUGIN_OPTIONS) private options: ShopPluginOptions) {}

    static init(options?: ShopPluginOptions): Type<ShopPlugin> {
        ShopPlugin.options = options ?? {};
        return ShopPlugin;
    }
}