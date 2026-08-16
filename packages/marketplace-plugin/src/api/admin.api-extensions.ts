export const adminApiExtensions = `
    extend type Mutation {
        approveMarketplaceProduct(productId: ID!): Boolean!
        rejectMarketplaceProduct(productId: ID!, reason: String!): Boolean!
    }
    extend type Query {
        marketplacePendingProducts: [Product!]!
        marketplaceMerchantChannel: Channel!
        merchantOrders(saleSource: String, options: OrderListOptions): OrderList!
    }
`;