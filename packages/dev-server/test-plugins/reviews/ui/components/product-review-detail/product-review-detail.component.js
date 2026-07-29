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
exports.ProductReviewDetailComponent = exports.GET_REVIEW_DETAIL = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const core_2 = require("@vendure/admin-ui/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const fragments_graphql_1 = require("../../common/fragments.graphql");
const generated_types_1 = require("../../generated-types");
const review_state_label_component_1 = require("../review-state-label/review-state-label.component");
const star_rating_component_1 = require("../star-rating/star-rating.component");
exports.GET_REVIEW_DETAIL = (0, graphql_tag_1.default) `
    query GetReviewDetail($id: ID!) {
        productReview(id: $id) {
            ...ProductReview
            product {
                id
                name
                featuredAsset {
                    id
                    preview
                }
            }
            productVariant {
                id
                name
                featuredAsset {
                    id
                    preview
                }
            }
        }
    }
    ${fragments_graphql_1.PRODUCT_REVIEW_FRAGMENT}
`;
let ProductReviewDetailComponent = class ProductReviewDetailComponent extends core_2.TypedBaseDetailComponent {
    constructor(formBuilder, dataService, changeDetector, notificationService) {
        super();
        this.formBuilder = formBuilder;
        this.dataService = dataService;
        this.changeDetector = changeDetector;
        this.notificationService = notificationService;
        this.detailForm = this.formBuilder.group({
            summary: ['', forms_1.Validators.required],
            body: '',
            rating: [0, forms_1.Validators.required],
            authorName: ['', forms_1.Validators.required],
            authorLocation: '',
            state: '',
            response: '',
        });
    }
    ngOnInit() {
        this.init();
        this.reviewState$ = this.entity$.pipe((0, operators_1.map)(review => review.state));
    }
    ngOnDestroy() {
        this.destroy();
    }
    approve() {
        this.saveChanges()
            .pipe((0, operators_1.switchMap)(() => this.dataService.mutate(generated_types_1.ApproveReviewDocument, { id: this.id })))
            .subscribe(() => {
            this.detailForm.markAsPristine();
            this.changeDetector.markForCheck();
            this.notificationService.success('Review was approved');
        }, () => {
            this.notificationService.error('An error occurred when attempting to approve the review');
        });
    }
    reject() {
        this.saveChanges()
            .pipe((0, operators_1.switchMap)(() => this.dataService.mutate(generated_types_1.RejectReviewDocument, { id: this.id })))
            .subscribe(() => {
            this.detailForm.markAsPristine();
            this.changeDetector.markForCheck();
            this.notificationService.success('Review was rejected');
        }, () => {
            this.notificationService.error('An error occurred when attempting to reject the review');
        });
    }
    save() {
        this.saveChanges()
            .pipe((0, operators_1.filter)(result => !!result))
            .subscribe(() => {
            this.detailForm.markAsPristine();
            this.changeDetector.markForCheck();
            this.notificationService.success('common.notify-update-success', {
                entity: 'ProductReview',
            });
        }, () => {
            this.notificationService.error('common.notify-update-error', {
                entity: 'ProductReview',
            });
        });
    }
    saveChanges() {
        if (this.detailForm.dirty) {
            const { summary, body, response } = this.detailForm.value;
            const input = {
                id: this.id,
                summary: summary !== null && summary !== void 0 ? summary : undefined,
                body: body !== null && body !== void 0 ? body : undefined,
                response: response !== null && response !== void 0 ? response : undefined,
            };
            return this.dataService.mutate(generated_types_1.UpdateReviewDocument, { input }).pipe((0, operators_1.mapTo)(true));
        }
        else {
            return (0, rxjs_1.of)(false);
        }
    }
    setFormValues(entity) {
        this.detailForm.patchValue({
            summary: entity.summary,
            body: entity.body,
            rating: entity.rating,
            authorName: entity.authorName,
            authorLocation: entity.authorLocation,
            state: entity.state,
            response: entity.response,
        });
    }
};
exports.ProductReviewDetailComponent = ProductReviewDetailComponent;
exports.ProductReviewDetailComponent = ProductReviewDetailComponent = __decorate([
    (0, core_1.Component)({
        selector: 'product-review-detail',
        templateUrl: './product-review-detail.component.html',
        styleUrls: ['./product-review-detail.component.scss'],
        changeDetection: core_1.ChangeDetectionStrategy.Default,
        standalone: true,
        imports: [core_2.SharedModule, star_rating_component_1.StarRatingComponent, review_state_label_component_1.ReviewStateLabelComponent],
    }),
    __metadata("design:paramtypes", [forms_1.FormBuilder,
        core_2.DataService,
        core_1.ChangeDetectorRef,
        core_2.NotificationService])
], ProductReviewDetailComponent);
//# sourceMappingURL=product-review-detail.component.js.map