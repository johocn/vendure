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
exports.ProductReviewsListComponent = exports.GET_PRODUCT_PREVIEW_AND_HISTOGRAM = exports.GET_REVIEWS_FOR_PRODUCT = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const core_2 = require("@vendure/admin-ui/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const operators_1 = require("rxjs/operators");
const fragments_graphql_1 = require("../../common/fragments.graphql");
const generated_types_1 = require("../../generated-types");
const review_histogram_component_1 = require("../review-histogram/review-histogram.component");
const star_rating_component_1 = require("../star-rating/star-rating.component");
exports.GET_REVIEWS_FOR_PRODUCT = (0, graphql_tag_1.default) `
    query GetReviewForProduct($productId: ID!, $options: ProductReviewListOptions) {
        product(id: $productId) {
            id
            reviews(options: $options) {
                items {
                    ...ProductReview
                }
                totalItems
            }
        }
    }
    ${fragments_graphql_1.PRODUCT_REVIEW_FRAGMENT}
`;
exports.GET_PRODUCT_PREVIEW_AND_HISTOGRAM = (0, graphql_tag_1.default) `
    query GetReviewsHistogram($id: ID!) {
        product(id: $id) {
            id
            name
            featuredAsset {
                id
                preview
            }
            customFields {
                reviewRating
                reviewCount
            }
            reviewsHistogram {
                bin
                frequency
            }
        }
    }
`;
let ProductReviewsListComponent = class ProductReviewsListComponent extends core_2.BaseListComponent {
    constructor(dataService, router, route) {
        super(router, route);
        this.dataService = dataService;
        this.router = router;
        // Here we set up the filters that will be available
        // to use in the data table
        this.filters = new core_2.DataTableFilterCollection(this.router)
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
        this.sorts = new core_2.DataTableSortCollection(this.router)
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
        super.setQueryFn((...args) => {
            return this.dataService.query(generated_types_1.GetReviewForProductDocument, args);
        }, 
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        data => data.product.reviews, (skip, take) => {
            var _a;
            return {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                productId: route.snapshot.parent.paramMap.get('id'),
                options: {
                    skip,
                    take,
                    sort: this.sorts.createSortInput(),
                    filter: Object.assign({ authorName: {
                            contains: (_a = this.searchTermControl.value) !== null && _a !== void 0 ? _a : undefined,
                        } }, this.filters.createFilterInput()),
                },
            };
        });
    }
    ngOnInit() {
        super.ngOnInit();
        const productWithHistogram$ = this.dataService
            .query(generated_types_1.GetReviewsHistogramDocument, {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            id: this.route.snapshot.parent.paramMap.get('id') || '',
        })
            .single$.pipe((0, operators_1.shareReplay)(1));
        this.histogramBinData$ = productWithHistogram$.pipe((0, operators_1.map)(data => (data.product ? data.product.reviewsHistogram : [])));
        this.product$ = productWithHistogram$.pipe((0, operators_1.map)(data => data.product));
        this.refreshListOnChanges(this.filters.valueChanges, this.sorts.valueChanges);
    }
    applyRatingFilters(filteredBin) {
        this.filteredRating = filteredBin;
        this.refresh();
    }
};
exports.ProductReviewsListComponent = ProductReviewsListComponent;
exports.ProductReviewsListComponent = ProductReviewsListComponent = __decorate([
    (0, core_1.Component)({
        selector: 'product-reviews-list',
        templateUrl: './product-reviews-list.component.html',
        styleUrls: ['./product-reviews-list.component.scss'],
        changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        standalone: true,
        imports: [core_2.SharedModule, star_rating_component_1.StarRatingComponent, review_histogram_component_1.ReviewHistogramComponent],
    }),
    __metadata("design:paramtypes", [core_2.DataService, router_1.Router, router_1.ActivatedRoute])
], ProductReviewsListComponent);
//# sourceMappingURL=product-reviews-list.component.js.map