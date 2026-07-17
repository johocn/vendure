import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { REVIEW_PLUGIN_OPTIONS } from './constants';
import { Review } from './review.entity';
import { ReviewAdminResolver } from './review-admin.resolver';
import { ReviewService } from './review.service';
import { ReviewShopResolver } from './review-shop.resolver';
import { ReviewPluginOptions } from './types';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type Review implements Node {
        id: ID!
        customerId: ID!
        customerName: String
        productId: ID!
        variantId: ID
        orderLineId: ID
        rating: Int!
        content: String!
        images: [String!]
        videos: [String!]
        tags: [String!]
        isAnonymous: Boolean!
        status: String!
        reply: String
        repliedAt: DateTime
        helpfulCount: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type ReviewList implements PaginatedList {
        items: [Review!]!
        totalItems: Int!
    }

    input ReviewListOptions {
        skip: Int
        take: Int
        productId: ID
        status: String
    }

    type RatingCount {
        rating: Int!
        count: Int!
    }

    type TagCount {
        tag: String!
        count: Int!
    }

    type ReviewStats {
        totalCount: Int!
        goodRate: Float!
        averageRating: Float!
        ratingDistribution: [RatingCount!]!
        topTags: [TagCount!]!
    }

    extend type Query {
        reviews(options: ReviewListOptions): ReviewList!
        review(id: ID!): Review
        reviewStats(productId: ID!): ReviewStats!
    }

    extend type Mutation {
        replyReview(id: ID!, reply: String!): Review!
        approveReview(id: ID!): Review!
        rejectReview(id: ID!): Review!
    }
`;

const shopSchema = () => gql`
    type Review implements Node {
        id: ID!
        customerId: ID!
        customerName: String
        productId: ID!
        variantId: ID
        orderLineId: ID
        rating: Int!
        content: String!
        images: [String!]
        videos: [String!]
        tags: [String!]
        isAnonymous: Boolean!
        status: String!
        reply: String
        repliedAt: DateTime
        helpfulCount: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type ReviewList implements PaginatedList {
        items: [Review!]!
        totalItems: Int!
    }

    input ReviewListOptions {
        skip: Int
        take: Int
    }

    input CreateReviewInput {
        productId: ID!
        orderLineId: ID
        variantId: ID
        rating: Int!
        content: String!
        images: [String!]
        videos: [String!]
        tags: [String!]
        isAnonymous: Boolean
    }

    type ReviewStats {
        totalCount: Int!
        goodRate: Float!
        averageRating: Float!
        ratingDistribution: [RatingCount!]!
        topTags: [TagCount!]!
    }

    type RatingCount {
        rating: Int!
        count: Int!
    }

    type TagCount {
        tag: String!
        count: Int!
    }

    extend type Query {
        productReviews(productId: ID!, options: ReviewListOptions): ReviewList!
        myReviews: [Review!]!
        reviewStats(productId: ID!): ReviewStats!
    }

    extend type Mutation {
        createReview(input: CreateReviewInput!): Review!
        markReviewHelpful(id: ID!): Review!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Review],
    providers: [
        { provide: REVIEW_PLUGIN_OPTIONS, useFactory: () => ReviewPlugin.options },
        ReviewService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [ReviewAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [ReviewShopResolver],
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class ReviewPlugin {
    private static options: ReviewPluginOptions = {};

    constructor(@Inject(REVIEW_PLUGIN_OPTIONS) private options: ReviewPluginOptions) {}

    static init(options?: ReviewPluginOptions): Type<ReviewPlugin> {
        ReviewPlugin.options = options ?? {};
        return ReviewPlugin;
    }
}
