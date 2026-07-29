"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopApiExtensions = exports.adminApiExtensions = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const productBundleAdminApiExtensions = (0, graphql_tag_1.default) `
    type ProductBundle implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        name: String!
        description: String!
    }

    type ProductBundleItem {
        productVariant: ProductVariant!
        price: Money!
        quantity: Int!
    }

    type ProductBundleList implements PaginatedList {
        items: [ProductBundle!]!
        totalItems: Int!
    }

    # Generated at run-time by Vendure
    input ProductBundleListOptions

    extend type Query {
        productBundle(id: ID!): ProductBundle
        productBundles(options: ProductBundleListOptions): ProductBundleList!
    }

    input CreateProductBundleInput {
        name: String!
        description: String!
    }

    input UpdateProductBundleInput {
        id: ID!
        name: String
        description: String
    }

    input CreateProductBundleItemInput {
        bundleId: ID!
        productVariantId: ID!
        price: Money!
        quantity: Int!
    }

    input UpdateProductBundleItemInput {
        id: ID!
        price: Money
        quantity: Int
    }

    extend type Mutation {
        createProductBundle(input: CreateProductBundleInput!): ProductBundle!
        updateProductBundle(input: UpdateProductBundleInput!): ProductBundle!
        deleteProductBundle(id: ID!): DeletionResponse!
        createProductBundleItem(input: CreateProductBundleItemInput!): ProductBundleItem!
        updateProductBundleItem(input: UpdateProductBundleItemInput!): ProductBundleItem!
        deleteProductBundleItem(id: ID!): DeletionResponse!
    }
`;
exports.adminApiExtensions = (0, graphql_tag_1.default) `
    ${productBundleAdminApiExtensions}
`;
exports.shopApiExtensions = (0, graphql_tag_1.default) `
    extend type Mutation {
        addProductBundleToOrder(bundleId: ID!): UpdateOrderItemsResult!
        removeProductBundleFromOrder(bundleId: ID!): RemoveOrderItemsResult!
    }
`;
//# sourceMappingURL=api-extensions.js.map