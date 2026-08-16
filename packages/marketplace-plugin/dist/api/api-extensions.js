"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopApiExtensions = void 0;
exports.shopApiExtensions = `
    extend type Mutation {
        registerMarketplaceSeller(input: RegisterMarketplaceSellerInput!): RegisterMarketplaceSellerResult!
    }

    extend type Query {
        marketplaceProducts: [MarketplaceProduct!]!
    }

    type MarketplaceProduct {
        id: ID!
        name: String!
        slug: String!
        barcode: String
        internalCode: String
        merchantChannel: MarketplaceMerchantChannel
    }

    type MarketplaceMerchantChannel {
        id: ID!
        code: String!
        name: String!
    }

    input RegisterMarketplaceSellerInput {
        shopName: String!
        seller: CreateSellerInput!
    }

    input CreateSellerInput {
        firstName: String!
        lastName: String!
        emailAddress: String!
        password: String!
    }

    type RegisterMarketplaceSellerSuccess {
        id: ID!
        code: String!
        token: String!
    }

    union RegisterMarketplaceSellerResult = RegisterMarketplaceSellerSuccess | ErrorResult
`;
