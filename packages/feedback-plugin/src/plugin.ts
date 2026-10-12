import { Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { FaqEntry } from './faq-entry.entity';
import { Feedback } from './feedback.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackAdminResolver, FeedbackShopResolver } from './feedback.resolvers';

const { gql } = require('graphql-tag');

const shopSchema = () => gql`
    type FaqEntry implements Node {
        id: ID!
        title: String!
        content: String!
        type: String!
        sort: Int!
    }
    type Feedback implements Node {
        id: ID!
        customerId: ID!
        type: String!
        title: String!
        content: String!
        imgs: String
        contactWay: String
        status: String!
        reply: String
        repliedAt: DateTime
        repliedBy: String
        readAt: DateTime
        createdAt: DateTime!
    }
    type FeedbackList implements PaginatedList {
        items: [Feedback!]!
        totalItems: Int!
    }
    input FeedbackListOptions {
        skip: Int
        take: Int
    }
    input CreateFeedbackInput {
        type: String
        title: String!
        content: String!
        imgs: [String!]
        contactWay: String
    }
    extend type Query {
        faqs(type: String, lang: String): [FaqEntry!]!
        myFeedbacks(options: FeedbackListOptions): FeedbackList!
        unreadFeedbackCount: Int!
    }
    extend type Mutation {
        createFeedback(input: CreateFeedbackInput!): Feedback!
        markFeedbacksRead: Int!
    }
`;

const adminSchema = () => gql`
    type FaqEntry implements Node {
        id: ID!
        title: String!
        content: String!
        type: String!
        sort: Int!
        enabled: Boolean!
        titleI18n: String
        contentI18n: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type FaqEntryList implements PaginatedList {
        items: [FaqEntry!]!
        totalItems: Int!
    }
    input FaqEntryListOptions {
        skip: Int
        take: Int
    }
    input SaveFaqInput {
        id: ID
        title: String!
        content: String!
        type: String
        sort: Int
        enabled: Boolean
        titleI18n: JSON
        contentI18n: JSON
    }
    type Feedback implements Node {
        id: ID!
        customerId: ID!
        type: String!
        title: String!
        content: String!
        imgs: String
        contactWay: String
        status: String!
        reply: String
        repliedAt: DateTime
        repliedBy: String
        readAt: DateTime
        handledAt: DateTime
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type FeedbackList implements PaginatedList {
        items: [Feedback!]!
        totalItems: Int!
    }
    input FeedbackListOptions {
        skip: Int
        take: Int
        status: String
    }
    extend type Query {
        faqEntries(options: FaqEntryListOptions): FaqEntryList!
        feedbacks(options: FeedbackListOptions): FeedbackList!
    }
    extend type Mutation {
        saveFaq(input: SaveFaqInput!): FaqEntry!
        deleteFaq(id: ID!): Boolean!
        updateFeedbackStatus(id: ID!, status: String!): Feedback!
        replyFeedback(id: ID!, reply: String!, resolve: Boolean): Feedback!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [FaqEntry, Feedback],
    providers: [FeedbackService],
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [FeedbackShopResolver],
    },
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [FeedbackAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class FeedbackPlugin {
    static init(): Type<FeedbackPlugin> {
        return FeedbackPlugin;
    }
}
