"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopApiExtensions = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.shopApiExtensions = (0, graphql_tag_1.default) `
    input CreateSellerInput {
        firstName: String!
        lastName: String!
        emailAddress: String!
        password: String!
    }

    input RegisterSellerInput {
        shopName: String!
        seller: CreateSellerInput!
    }

    extend type Mutation {
        registerNewSeller(input: RegisterSellerInput!): Channel
    }
`;
//# sourceMappingURL=api-extensions.js.map