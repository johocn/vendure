"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopApiExtensions = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.shopApiExtensions = (0, graphql_tag_1.default) `
    type WishlistItem implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        productVariant: ProductVariant!
        productVariantId: ID!
    }

    extend type Query {
        activeCustomerWishlist: [WishlistItem!]!
    }

    extend type Mutation {
        addToWishlist(productVariantId: ID!): [WishlistItem!]!
        removeFromWishlist(itemId: ID!): [WishlistItem!]!
    }
`;
//# sourceMappingURL=api-extensions.js.map