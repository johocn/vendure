"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewDetail = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const graphql_1 = require("@/graphql/graphql");
const dashboard_1 = require("@vendure/dashboard");
const reviewDetailDocument = (0, graphql_1.graphql)(`
    query GetReviewDetail($id: ID!) {
        productReview(id: $id) {
            id
            createdAt
            updatedAt
            product {
                id
                name
            }
            productVariant {
                id
                name
                sku
            }
            summary
            body
            rating
            authorName
            authorLocation
            upvotes
            downvotes
            state
            response
            responseCreatedAt
            translations {
                id
                languageCode
                text
            }
        }
    }
`);
const updateReviewDocument = (0, graphql_1.graphql)(`
    mutation UpdateReview($input: UpdateProductReviewInput!) {
        updateProductReview(input: $input) {
            id
        }
    }
`);
exports.reviewDetail = {
    path: '/reviews/$id',
    loader: (0, dashboard_1.detailPageRouteLoader)({
        queryDocument: reviewDetailDocument,
        breadcrumb: (isNew, entity) => [
            { path: '/reviews', label: 'Reviews' },
            isNew ? 'New review' : entity === null || entity === void 0 ? void 0 : entity.summary,
        ],
    }),
    component: route => {
        return ((0, jsx_runtime_1.jsx)(dashboard_1.DetailPage, { pageId: "review-detail", queryDocument: reviewDetailDocument, updateDocument: updateReviewDocument, route: route, title: review => review.summary, setValuesForUpdate: review => {
                return {
                    id: review.id,
                    summary: review.summary,
                    body: review.body,
                    response: review.response,
                    state: review.state,
                    customFields: review.customFields,
                    translations: review.translations,
                };
            } }));
    },
};
//# sourceMappingURL=review-detail.js.map