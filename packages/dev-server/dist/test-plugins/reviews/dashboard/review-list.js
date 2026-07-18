"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewList = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const graphql_1 = require("@/graphql/graphql");
const macro_1 = require("@lingui/react/macro");
const dashboard_1 = require("@vendure/dashboard");
const getReviewList = (0, graphql_1.graphql)(`
    query GetProductReviews($options: ProductReviewListOptions) {
        productReviews(options: $options) {
            items {
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
            }
        }
    }
`);
exports.reviewList = {
    navMenuItem: {
        sectionId: 'catalog',
        id: 'reviews',
        url: '/reviews',
        title: 'Product Reviews',
        requiresPermission: ['ReadCatalog'],
    },
    path: '/reviews',
    loader: () => ({
        breadcrumb: 'Reviews',
    }),
    component: route => ((0, jsx_runtime_1.jsx)(dashboard_1.ListPage, { pageId: "review-list", title: (0, jsx_runtime_1.jsx)(macro_1.Trans, { children: "Product Reviews" }), listQuery: getReviewList, route: route, defaultVisibility: {
            productVariant: false,
            product: false,
            summary: false,
            rating: false,
            authorName: false,
            reviewerName: false,
            responseCreatedAt: false,
            response: false,
            upvotes: false,
            downvotes: false,
        }, customizeColumns: {
            id: {
                header: 'ID',
                cell: ({ row }) => {
                    return (0, jsx_runtime_1.jsx)(dashboard_1.DetailPageButton, { id: row.original.id, label: row.original.id });
                },
            },
            product: {
                header: 'Product',
                cell: ({ row }) => {
                    return (0, jsx_runtime_1.jsx)(dashboard_1.DetailPageButton, { id: row.original.id, label: row.original.product.name });
                },
            },
            reviewerName: {
                header: 'Reviewer Name',
                cell: ({ row }) => {
                    var _a;
                    return (0, jsx_runtime_1.jsx)("div", { className: "text-red-500", children: (_a = row.original.customFields) === null || _a === void 0 ? void 0 : _a.reviewerName });
                },
            },
        }, children: (0, jsx_runtime_1.jsx)(dashboard_1.ActionBarItem, { itemId: "my-custom-button", children: (0, jsx_runtime_1.jsx)(dashboard_1.Button, { children: "My Button" }) }) })),
};
//# sourceMappingURL=review-list.js.map