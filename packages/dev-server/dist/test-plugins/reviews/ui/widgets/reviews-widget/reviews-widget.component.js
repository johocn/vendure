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
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const review_state_label_component_1 = require("../../components/review-state-label/review-state-label.component");
const star_rating_component_1 = require("../../components/star-rating/star-rating.component");
const generated_types_1 = require("../../generated-types");
const GET_REVIEWS_FOR_WIDGET = (0, graphql_tag_1.default) `
    query GetReviewsForWidget($options: ProductReviewListOptions) {
        productReviews(options: $options) {
            items {
                id
                authorName
                summary
                rating
                state
                createdAt
                product {
                    id
                    name
                }
            }
            totalItems
        }
    }
`;
let ReviewsWidgetComponent = class ReviewsWidgetComponent {
    constructor(dataService) {
        this.dataService = dataService;
    }
    ngOnInit() {
        this.pendingReviews$ = this.dataService
            .query(generated_types_1.GetReviewsForWidgetDocument, {
            options: {
                filter: {
                    state: {
                        eq: 'new',
                    },
                },
                take: 10,
            },
        })
            .mapStream(data => data.productReviews.items);
    }
};
ReviewsWidgetComponent = __decorate([
    (0, core_1.Component)({
        selector: 'vdr-reviews-widget',
        templateUrl: './reviews-widget.component.html',
        styleUrls: ['./reviews-widget.component.scss'],
        changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        standalone: true,
        imports: [core_2.SharedModule, star_rating_component_1.StarRatingComponent, review_state_label_component_1.ReviewStateLabelComponent],
    }),
    __metadata("design:paramtypes", [core_2.DataService])
], ReviewsWidgetComponent);
exports.default = ReviewsWidgetComponent;
//# sourceMappingURL=reviews-widget.component.js.map