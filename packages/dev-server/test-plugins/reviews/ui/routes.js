"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/admin-ui/core");
const react_1 = require("@vendure/admin-ui/react");
const product_review_detail_component_1 = require("./components/product-review-detail/product-review-detail.component");
const generated_types_1 = require("./generated-types");
const AllProductReviewsList_1 = require("./react/AllProductReviewsList");
exports.default = [
    // registerRouteComponent({
    //     path: '',
    //     component: AllProductReviewsListComponent,
    //     breadcrumb: 'Product reviews',
    // }),
    (0, react_1.registerReactRouteComponent)({
        path: '',
        component: AllProductReviewsList_1.AllProductReviewsList,
        breadcrumb: 'Product reviews',
    }),
    (0, core_1.registerRouteComponent)({
        path: ':id',
        component: product_review_detail_component_1.ProductReviewDetailComponent,
        query: generated_types_1.GetReviewDetailDocument,
        entityKey: 'productReview',
        getBreadcrumbs: entity => [
            {
                label: 'Product reviews',
                link: ['/extensions', 'product-reviews'],
            },
            {
                label: `#${entity === null || entity === void 0 ? void 0 : entity.id} (${entity === null || entity === void 0 ? void 0 : entity.product.name})`,
                link: [],
            },
        ],
    }),
];
//# sourceMappingURL=routes.js.map