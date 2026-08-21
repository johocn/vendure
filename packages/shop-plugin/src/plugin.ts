import { Inject, Type } from '@nestjs/common';
import { PermissionDefinition, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { SHOP_PLUGIN_OPTIONS } from './constants';
import { manageOwnShop } from './merchant-permissions';
import { MerchantResolver } from './merchant-resolver';
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

/** 幂等并入自定义权限定义（PermissionDefinition 按 metadata name 去重），避免重复注册。 */
function mergeCustomPermissions(
    existing: PermissionDefinition[] | undefined,
    additions: PermissionDefinition[],
): PermissionDefinition[] {
    const names = new Set((existing ?? []).flatMap(d => d.getMetadata().map(m => m.name)));
    return [
        ...(existing ?? []),
        ...additions.filter(d => !d.getMetadata().some(m => names.has(m.name))),
    ];
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
        administratorId: ID
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

    input CreateOwnerInput {
        emailAddress: String!
        password: String!
        firstName: String
        lastName: String
    }

    input UpdateMyShopInput {
        name: String
        description: String
        logoAssetId: ID
        bannerAssetId: ID
    }

    input UpdateMyShopProductInput {
        name: String
        description: String
    }

    type MerchantOrderLine {
        orderLineId: ID!
        productId: ID!
        productName: String!
        variantName: String!
        quantity: Int!
        unitPriceWithTax: Int!
        lineTotalWithTax: Int!
    }

    type MerchantOrder {
        orderId: ID!
        code: String!
        state: String!
        totalWithTax: Int!
        currencyCode: String!
        customerName: String
        placedAt: DateTime
        items: [MerchantOrderLine!]!
    }

    type MerchantReview {
        reviewId: ID!
        productId: ID!
        productName: String!
        rating: Int!
        content: String!
        status: String!
        customerName: String
        createdAt: DateTime!
    }

    extend type Query {
        myShop: Shop!
        myShopProducts(options: ShopListOptions): ProductList!
        myShopOrder(orderId: ID!): MerchantOrder
        myShopOrders: [MerchantOrder!]!
        myShopReviews: [MerchantReview!]!
    }

    extend type Mutation {
        provisionShopOwner(shopId: ID!, input: CreateOwnerInput!): Administrator
        updateMyShop(input: UpdateMyShopInput!): Shop!
        addProductToMyShop(productId: ID!): Boolean!
        removeProductFromMyShop(productId: ID!): Boolean!
        updateMyShopProduct(productId: ID!, input: UpdateMyShopProductInput!): Product
        approveMerchantReview(id: ID!): Boolean!
        rejectMerchantReview(id: ID!): Boolean!
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
        resolvers: [ShopAdminResolver, MerchantResolver],
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
        // 店主自营后台权限：ManageOwnShop（自定义权限，可分配到 Role）
        config.authOptions.customPermissions = mergeCustomPermissions(
            config.authOptions.customPermissions,
            [manageOwnShop],
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