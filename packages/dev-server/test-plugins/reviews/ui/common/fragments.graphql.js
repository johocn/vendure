"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_REVIEW_FRAGMENT = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.PRODUCT_REVIEW_FRAGMENT = (0, graphql_tag_1.default) `
    fragment ProductReview on ProductReview {
        id
        createdAt
        updatedAt
        authorName
        authorLocation
        summary
        body
        rating
        state
        upvotes
        downvotes
        response
        responseCreatedAt
    }
`;
//# sourceMappingURL=fragments.graphql.js.map