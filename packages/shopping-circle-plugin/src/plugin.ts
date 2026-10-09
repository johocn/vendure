import { Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { CircleFavorite } from './circle-favorite.entity';
import { CircleLike } from './circle-like.entity';
import { CirclePost } from './circle-post.entity';
import { CircleService } from './circle.service';
import { CircleAdminResolver, CircleShopResolver } from './circle.resolvers';

const { gql } = require('graphql-tag');

const shopSchema = () => gql`
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

const adminSchema = () => gql`
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

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [CirclePost, CircleLike, CircleFavorite],
    providers: [CircleService],
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [CircleShopResolver],
    },
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [CircleAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class ShoppingCirclePlugin {
    static init(): Type<ShoppingCirclePlugin> {
        return ShoppingCirclePlugin;
    }
}
