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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationReviewInputComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const router_1 = require("@angular/router");
const core_2 = require("@vendure/admin-ui/core");
const operators_1 = require("rxjs/operators");
const generated_types_1 = require("../../generated-types");
let RelationReviewInputComponent = class RelationReviewInputComponent {
    constructor(dataService, route) {
        this.dataService = dataService;
        this.route = route;
    }
    ngOnInit() {
        this.reviews$ = this.route.data.pipe((0, operators_1.switchMap)(data => data.detail.entity), (0, operators_1.switchMap)((product) => {
            return this.dataService
                .query(generated_types_1.GetReviewForProductDocument, {
                productId: product.id,
            })
                .mapSingle(({ product }) => { var _a; return (_a = product === null || product === void 0 ? void 0 : product.reviews.items) !== null && _a !== void 0 ? _a : []; });
        }));
    }
};
exports.RelationReviewInputComponent = RelationReviewInputComponent;
__decorate([
    (0, core_1.Input)(),
    __metadata("design:type", Boolean)
], RelationReviewInputComponent.prototype, "readonly", void 0);
__decorate([
    (0, core_1.Input)(),
    __metadata("design:type", forms_1.FormControl)
], RelationReviewInputComponent.prototype, "formControl", void 0);
__decorate([
    (0, core_1.Input)(),
    __metadata("design:type", Object)
], RelationReviewInputComponent.prototype, "config", void 0);
exports.RelationReviewInputComponent = RelationReviewInputComponent = __decorate([
    (0, core_1.Component)({
        selector: 'kb-relation-review-input',
        template: `
        <div *ngIf="formControl.value as review">
            <vdr-chip>{{ review.rating }} / 5</vdr-chip>
            {{ review.summary }}
            <a [routerLink]="['/extensions', 'product-reviews', review.id]">
                <clr-icon shape="link"></clr-icon>
            </a>
        </div>
        <select class="mt-1" [formControl]="formControl">
            <option [ngValue]="null">Select a review...</option>
            <option *ngFor="let item of reviews$ | async" [ngValue]="item">
                <b>{{ item.summary }}</b>
                {{ item.rating }} / 5
            </option>
        </select>
    `,
        changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        standalone: true,
        imports: [core_2.SharedModule],
    }),
    __metadata("design:paramtypes", [core_2.DataService, router_1.ActivatedRoute])
], RelationReviewInputComponent);
//# sourceMappingURL=featured-review-selector.component.js.map