"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminApiExtensions = void 0;
exports.adminApiExtensions = `
    extend type Mutation {
        approveMarketplaceProduct(productId: ID!): Boolean!
        rejectMarketplaceProduct(productId: ID!, reason: String!): Boolean!
        submitForMarketplaceAdmin(productId: ID!): Boolean!
    }
    extend type Query {
        marketplacePendingProducts: [Product!]!
        marketplaceMerchantChannel: Channel!
        merchantOrders(saleSource: String, options: OrderListOptions): OrderList!
    }
`;
