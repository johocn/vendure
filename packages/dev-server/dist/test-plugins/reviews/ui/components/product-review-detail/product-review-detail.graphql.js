"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REJECT_REVIEW = exports.APPROVE_REVIEW = exports.UPDATE_REVIEW = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const fragments_graphql_1 = require("../../common/fragments.graphql");
exports.UPDATE_REVIEW = (0, graphql_tag_1.default) `
    mutation UpdateReview($input: UpdateProductReviewInput!) {
        updateProductReview(input: $input) {
            ...ProductReview
        }
    }
    ${fragments_graphql_1.PRODUCT_REVIEW_FRAGMENT}
`;
exports.APPROVE_REVIEW = (0, graphql_tag_1.default) `
    mutation ApproveReview($id: ID!) {
        approveProductReview(id: $id) {
            id
            state
            product {
                id
                customFields {
                    reviewCount
                    reviewRating
                }
            }
        }
    }
`;
exports.REJECT_REVIEW = (0, graphql_tag_1.default) `
    mutation RejectReview($id: ID!) {
        rejectProductReview(id: $id) {
            id
            state
        }
    }
`;
//# sourceMappingURL=product-review-detail.graphql.js.map