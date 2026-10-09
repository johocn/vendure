"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FeedbackPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackPlugin = void 0;
const core_1 = require("@vendure/core");
const faq_entry_entity_1 = require("./faq-entry.entity");
const feedback_entity_1 = require("./feedback.entity");
const feedback_service_1 = require("./feedback.service");
const feedback_resolvers_1 = require("./feedback.resolvers");
const { gql } = require('graphql-tag');
const shopSchema = () => gql `
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
        faqs(type: String): [FaqEntry!]!
        myFeedbacks(options: FeedbackListOptions): FeedbackList!
    }
    extend type Mutation {
        createFeedback(input: CreateFeedbackInput!): Feedback!
    }
`;
const adminSchema = () => gql `
    type FaqEntry implements Node {
        id: ID!
        title: String!
        content: String!
        type: String!
        sort: Int!
        enabled: Boolean!
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
    }
`;
let FeedbackPlugin = FeedbackPlugin_1 = class FeedbackPlugin {
    static init() {
        return FeedbackPlugin_1;
    }
};
exports.FeedbackPlugin = FeedbackPlugin;
exports.FeedbackPlugin = FeedbackPlugin = FeedbackPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [faq_entry_entity_1.FaqEntry, feedback_entity_1.Feedback],
        providers: [feedback_service_1.FeedbackService],
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [feedback_resolvers_1.FeedbackShopResolver],
        },
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [feedback_resolvers_1.FeedbackAdminResolver],
        },
        compatibility: '^3.0.0',
    })
], FeedbackPlugin);
//# sourceMappingURL=plugin.js.map