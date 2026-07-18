"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/admin-ui/core");
const featured_review_selector_component_1 = require("./components/featured-review-selector/featured-review-selector.component");
const product_reviews_list_component_1 = require("./components/product-reviews-list/product-reviews-list.component");
const review_count_link_component_1 = require("./components/review-count-link/review-count-link.component");
const star_rating_component_1 = require("./components/star-rating/star-rating.component");
exports.default = [
    (0, core_1.registerFormInputComponent)('review-count-link', review_count_link_component_1.ReviewCountLinkComponent),
    (0, core_1.registerFormInputComponent)('star-rating-form-input', star_rating_component_1.StarRatingComponent),
    (0, core_1.registerFormInputComponent)('review-selector-form-input', featured_review_selector_component_1.RelationReviewInputComponent),
    (0, core_1.addNavMenuItem)({
        id: 'reviews',
        label: 'Product reviews',
        routerLink: ['/extensions/product-reviews'],
        icon: 'star',
    }, 'marketing'),
    (0, core_1.registerDashboardWidget)('reviews', {
        title: 'Latest reviews',
        supportedWidths: [4, 6, 8, 12],
        loadComponent: () => import('./widgets/reviews-widget/reviews-widget.component').then(m => m.default),
    }),
    (0, core_1.setDashboardWidgetLayout)([
        { id: 'metrics', width: 12 },
        { id: 'orderSummary', width: 6 },
        { id: 'reviews', width: 6 },
        { id: 'latestOrders', width: 12 },
    ]),
    (0, core_1.registerPageTab)({
        location: 'product-detail',
        route: 'reviews',
        tab: 'Reviews',
        tabIcon: 'star',
        component: product_reviews_list_component_1.ProductReviewsListComponent,
    }),
];
//# sourceMappingURL=providers.js.map