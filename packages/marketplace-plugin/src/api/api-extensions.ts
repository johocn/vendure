export const shopApiExtensions = `
    extend type Mutation {
        registerMarketplaceSeller(input: RegisterMarketplaceSellerInput!): RegisterMarketplaceSellerResult!
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