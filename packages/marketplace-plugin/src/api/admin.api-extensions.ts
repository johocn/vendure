export const adminApiExtensions = `
    extend type Mutation {
        approveMarketplaceProduct(productId: ID!): Boolean!
        rejectMarketplaceProduct(productId: ID!, reason: String!): Boolean!
    }
    extend type Query {
        marketplacePendingProducts: [Product!]!
    }
`;