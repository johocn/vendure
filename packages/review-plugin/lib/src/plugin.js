"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReviewPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const review_entity_1 = require("./review.entity");
const review_admin_resolver_1 = require("./review-admin.resolver");
const review_service_1 = require("./review.service");
const review_shop_resolver_1 = require("./review-shop.resolver");
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
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
const shopSchema = () => gql `
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
let ReviewPlugin = ReviewPlugin_1 = class ReviewPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        ReviewPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return ReviewPlugin_1;
    }
};
exports.ReviewPlugin = ReviewPlugin;
ReviewPlugin.options = {};
exports.ReviewPlugin = ReviewPlugin = ReviewPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [review_entity_1.Review],
        providers: [
            { provide: constants_1.REVIEW_PLUGIN_OPTIONS, useFactory: () => ReviewPlugin.options },
            review_service_1.ReviewService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [review_admin_resolver_1.ReviewAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [review_shop_resolver_1.ReviewShopResolver],
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.REVIEW_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], ReviewPlugin);
//# sourceMappingURL=plugin.js.map