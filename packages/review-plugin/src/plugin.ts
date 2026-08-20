import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { REVIEW_PLUGIN_OPTIONS } from './constants';
import { Review } from './review.entity';
import { ReviewAdminResolver } from './review-admin.resolver';
import { reviewProductCustomFields } from './review-product-custom-fields';
import { ReviewService } from './review.service';
import { ReviewShopResolver } from './review-shop.resolver';
import { ReviewPluginOptions } from './types';

const { gql } = require('graphql-tag');

/** 幂等并入自定义字段，按 name 去重（preBootstrapConfig 可能多次执行插件配置）。 */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const adminSchema = () => gql`
    type Review implements Node {
        id: ID!
        customerId: ID!
        customerName: String
        productId: ID!
        variantId: ID
        orderLineId: ID
        parentId: ID
        followUps: [Review!]!
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

    type ProductRating {
        rating: Float!
        reviewCount: Int!
    }

    extend type Query {
        reviews(options: ReviewListOptions): ReviewList!
        review(id: ID!): Review
        reviewStats(productId: ID!): ReviewStats!
        productRating(productId: ID!): ProductRating!
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
        parentId: ID
        followUps: [Review!]!
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

    input UpdateReviewInput {
        content: String
        rating: Int
        images: [String!]
        videos: [String!]
        tags: [String!]
        isAnonymous: Boolean
    }

    input FollowUpReviewInput {
        content: String
        rating: Int
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

    type ProductRating {
        rating: Float!
        reviewCount: Int!
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
        productRating(productId: ID!): ProductRating!
    }

    extend type Mutation {
        createReview(input: CreateReviewInput!): Review!
        updateReview(id: ID!, input: UpdateReviewInput!): Review!
        deleteReview(id: ID!): Boolean!
        createFollowUpReview(reviewId: ID!, input: FollowUpReviewInput!): Review!
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
    configuration: (config) => {
        // 评星驱动的商品评分聚合结果写入 Product 自定义字段
        config.customFields.Product = mergeCustomFields(
            config.customFields.Product,
            reviewProductCustomFields.Product,
        );
        return config;
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
