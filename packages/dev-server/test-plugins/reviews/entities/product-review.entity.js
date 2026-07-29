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
exports.ProductReview = exports.CustomReviewFields = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const product_review_translation_entity_1 = require("./product-review-translation.entity");
class CustomReviewFields {
}
exports.CustomReviewFields = CustomReviewFields;
let ProductReview = class ProductReview extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ProductReview = ProductReview;
__decorate([
    (0, typeorm_1.ManyToOne)(type => core_1.Product),
    __metadata("design:type", core_1.Product)
], ProductReview.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(type => core_1.ProductVariant),
    __metadata("design:type", Object)
], ProductReview.prototype, "productVariant", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProductReview.prototype, "summary", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], ProductReview.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ProductReview.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(type => core_1.Customer),
    __metadata("design:type", core_1.Customer)
], ProductReview.prototype, "author", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProductReview.prototype, "authorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProductReview.prototype, "authorLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], ProductReview.prototype, "upvotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], ProductReview.prototype, "downvotes", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], ProductReview.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true, default: null }),
    __metadata("design:type", String)
], ProductReview.prototype, "response", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: null }),
    __metadata("design:type", Date)
], ProductReview.prototype, "responseCreatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => product_review_translation_entity_1.ProductReviewTranslation, translation => translation.base, { eager: true }),
    __metadata("design:type", Array)
], ProductReview.prototype, "translations", void 0);
__decorate([
    (0, typeorm_1.Column)(type => CustomReviewFields),
    __metadata("design:type", CustomReviewFields)
], ProductReview.prototype, "customFields", void 0);
exports.ProductReview = ProductReview = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], ProductReview);
//# sourceMappingURL=product-review.entity.js.map