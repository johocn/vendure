"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ShoppingCirclePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingCirclePlugin = void 0;
const core_1 = require("@vendure/core");
const circle_favorite_entity_1 = require("./circle-favorite.entity");
const circle_like_entity_1 = require("./circle-like.entity");
const circle_post_entity_1 = require("./circle-post.entity");
const circle_service_1 = require("./circle.service");
const circle_resolvers_1 = require("./circle.resolvers");
const { gql } = require('graphql-tag');
const shopSchema = () => gql `
    type CirclePost implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        customerId: ID!
        nickname: String!
        title: String
        content: String!
        images: [String!]!
        videoUrl: String
        productId: ID
        likeCount: Int!
        favoriteCount: Int!
        viewerLiked: Boolean!
        viewerFavorited: Boolean!
        isPinned: Boolean!
    }
    type CirclePostList implements PaginatedList {
        items: [CirclePost!]!
        totalItems: Int!
    }
    input CirclePostListOptions {
        skip: Int
        take: Int
    }
    input CreateCirclePostInput {
        title: String
        content: String!
        images: [String!]
        videoUrl: String
        productId: ID
    }
    type ToggleCircleResult {
        liked: Boolean!
        favorited: Boolean!
        likeCount: Int!
        favoriteCount: Int!
    }
    extend type Query {
        circleFeed(options: CirclePostListOptions): CirclePostList!
        myCirclePosts(options: CirclePostListOptions): CirclePostList!
        circlePost(id: ID!): CirclePost
    }
    extend type Mutation {
        createCirclePost(input: CreateCirclePostInput!): CirclePost!
        toggleCircleLike(postId: ID!): ToggleCircleResult!
        toggleCircleFavorite(postId: ID!): ToggleCircleResult!
    }
`;
const adminSchema = () => gql `
    type CirclePost implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        customerId: ID!
        title: String
        content: String!
        images: String
        videoUrl: String
        productId: ID
        likeCount: Int!
        favoriteCount: Int!
        status: String!
        isPinned: Boolean!
    }
    type CirclePostList implements PaginatedList {
        items: [CirclePost!]!
        totalItems: Int!
    }
    input CirclePostListOptions {
        skip: Int
        take: Int
    }
    input UpdateCirclePostInput {
        id: ID!
        status: String
        isPinned: Boolean
    }
    extend type Query {
        circlePosts(options: CirclePostListOptions): CirclePostList!
    }
    extend type Mutation {
        updateCirclePost(input: UpdateCirclePostInput!): CirclePost!
    }
`;
let ShoppingCirclePlugin = ShoppingCirclePlugin_1 = class ShoppingCirclePlugin {
    static init() {
        return ShoppingCirclePlugin_1;
    }
};
exports.ShoppingCirclePlugin = ShoppingCirclePlugin;
exports.ShoppingCirclePlugin = ShoppingCirclePlugin = ShoppingCirclePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [circle_post_entity_1.CirclePost, circle_like_entity_1.CircleLike, circle_favorite_entity_1.CircleFavorite],
        providers: [circle_service_1.CircleService],
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [circle_resolvers_1.CircleShopResolver],
        },
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [circle_resolvers_1.CircleAdminResolver],
        },
        compatibility: '^3.0.0',
    })
], ShoppingCirclePlugin);
//# sourceMappingURL=plugin.js.map