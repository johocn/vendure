"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopApiExtensions = exports.adminApiExtensions = exports.commonApiExtensions = void 0;
const graphql_tag_1 = require("graphql-tag");
exports.commonApiExtensions = (0, graphql_tag_1.gql) `
    type ProductReviewTranslation {
        id: ID!
        languageCode: LanguageCode!
        text: String!
    }

    type ProductReview implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        product: Product!
        productVariant: ProductVariant
        summary: String!
        body: String
        rating: Float!
        authorName: String!
        authorLocation: String
        upvotes: Int!
        downvotes: Int!
        state: String!
        response: String
        responseCreatedAt: DateTime
        translations: [ProductReviewTranslation!]!
    }

    type ProductReviewList implements PaginatedList {
        items: [ProductReview!]!
        totalItems: Int!
    }

    type ProductReviewHistogramItem {
        bin: Int!
        frequency: Int!
    }

    extend type Product {
        reviews(options: ProductReviewListOptions): ProductReviewList!
        reviewsHistogram: [ProductReviewHistogramItem!]!
    }

    # Auto-generated at runtime
    input ProductReviewListOptions
`;
exports.adminApiExtensions = (0, graphql_tag_1.gql) `
    ${exports.commonApiExtensions}

    input ProductReviewTranslationInput {
        languageCode: LanguageCode!
        text: String!
    }

    input UpdateProductReviewInput {
        id: ID!
        summary: String
        body: String
        response: String
        state: String
        translations: [ProductReviewTranslationInput!]!
    }

    extend type ProductReview {
        author: Customer
    }

    extend type Query {
        productReviews(options: ProductReviewListOptions): ProductReviewList!
        productReview(id: ID!): ProductReview
    }

    extend type Mutation {
        updateProductReview(input: UpdateProductReviewInput!): ProductReview!
        approveProductReview(id: ID!): ProductReview
        rejectProductReview(id: ID!): ProductReview
    }
`;
exports.shopApiExtensions = (0, graphql_tag_1.gql) `
    ${exports.commonApiExtensions}

    input SubmitProductReviewInput {
        productId: ID!
        variantId: ID
        customerId: ID
        summary: String!
        body: String!
        rating: Float!
        authorName: String!
        authorLocation: String
    }

    extend type Mutation {
        submitProductReview(input: SubmitProductReviewInput!): ProductReview!
        voteOnReview(id: ID!, vote: Boolean!): ProductReview!
    }
`;
