"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllProductReviewsListComponent = exports.GET_ALL_REVIEWS = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const fragments_graphql_1 = require("../../common/fragments.graphql");
const generated_types_1 = require("../../generated-types");
const review_state_label_component_1 = require("../review-state-label/review-state-label.component");
const star_rating_component_1 = require("../star-rating/star-rating.component");
exports.GET_ALL_REVIEWS = (0, graphql_tag_1.default) `
    query GetAllReviews($options: ProductReviewListOptions) {
        productReviews(options: $options) {
            items {
                ...ProductReview
                product {
                    id
                    name
                    featuredAsset {
                        id
                        preview
                    }
                }
            }
            totalItems
        }
    }
    ${fragments_graphql_1.PRODUCT_REVIEW_FRAGMENT}
`;
let AllProductReviewsListComponent = class AllProductReviewsListComponent extends core_2.TypedBaseListComponent {
    constructor() {
        super();
        this.filteredState = 'new';
        // Here we set up the filters that will be available
        // to use in the data table
        this.filters = this.createFilterCollection()
            .addDateFilters()
            .addFilter({
            name: 'summary',
            type: { kind: 'text' },
            label: 'Summary',
            filterField: 'summary',
        })
            .addFilter({
            name: 'rating',
            type: { kind: 'number' },
            label: 'Rating',
            filterField: 'rating',
        })
            .addFilter({
            name: 'state',
            type: {
                kind: 'select',
                options: [
                    { value: 'new', label: 'New' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'rejected', label: 'Rejected' },
                ],
            },
            label: 'State',
            filterField: 'state',
        })
            .addFilter({
            name: 'authorName',
            type: { kind: 'text' },
            label: 'Author',
            filterField: 'authorName',
        })
            .addFilter({
            name: 'authorLocation',
            type: { kind: 'text' },
            label: 'Location',
            filterField: 'authorLocation',
        })
            .addFilter({
            name: 'upvotes',
            type: { kind: 'number' },
            label: 'Upvotes',
            filterField: 'upvotes',
        })
            .addFilter({
            name: 'downvotes',
            type: { kind: 'number' },
            label: 'Downvotes',
            filterField: 'downvotes',
        })
            .connectToRoute(this.route);
        // Here we set up the sorting options that will be available
        // to use in the data table
        this.sorts = this.createSortCollection()
            .defaultSort('createdAt', 'DESC')
            .addSort({ name: 'createdAt' })
            .addSort({ name: 'updatedAt' })
            .addSort({ name: 'summary' })
            .addSort({ name: 'state' })
            .addSort({ name: 'upvotes' })
            .addSort({ name: 'downvotes' })
            .addSort({ name: 'rating' })
            .addSort({ name: 'authorName' })
            .addSort({ name: 'authorLocation' })
            .connectToRoute(this.route);
        super.configure({
            document: generated_types_1.GetAllReviewsDocument,
            getItems: data => data.productReviews,
            setVariables: (skip, take) => {
                var _a;
                return ({
                    options: {
                        skip,
                        take,
                        filter: Object.assign({ authorName: {
                                contains: (_a = this.searchTermControl.value) !== null && _a !== void 0 ? _a : undefined,
                            } }, this.filters.createFilterInput()),
                        sort: this.sorts.createSortInput(),
                    },
                });
            },
            refreshListOnChanges: [this.filters.valueChanges, this.sorts.valueChanges],
        });
    }
};
exports.AllProductReviewsListComponent = AllProductReviewsListComponent;
exports.AllProductReviewsListComponent = AllProductReviewsListComponent = __decorate([
    (0, core_1.Component)({
        selector: 'all-product-reviews-list',
        templateUrl: './all-product-reviews-list.component.html',
        styleUrls: ['./all-product-reviews-list.component.scss'],
        changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        standalone: true,
        imports: [core_2.SharedModule, star_rating_component_1.StarRatingComponent, review_state_label_component_1.ReviewStateLabelComponent],
    }),
    __metadata("design:paramtypes", [])
], AllProductReviewsListComponent);
//# sourceMappingURL=all-product-reviews-list.component.js.map