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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductEntityResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const product_review_entity_1 = require("../entities/product-review.entity");
const generated_shop_types_1 = require("../generated-shop-types");
let ProductEntityResolver = class ProductEntityResolver {
    constructor(listQueryBuilder, connection) {
        this.listQueryBuilder = listQueryBuilder;
        this.connection = connection;
    }
    reviews(apiType, product, args) {
        return this.listQueryBuilder
            .build(product_review_entity_1.ProductReview, args.options || undefined, {
            where: {
                product: { id: product.id },
                ...(apiType === 'shop' ? { state: 'approved' } : {}),
            },
            relations: ['product', 'product.featuredAsset'],
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({
            items,
            totalItems,
        }));
    }
    reviewsHistogram(product) {
        return this.connection.rawConnection
            .createQueryBuilder()
            .select('ROUND(`rating`)', 'bin')
            .addSelect('COUNT(*)', 'frequency')
            .from(product_review_entity_1.ProductReview, 'review')
            .where('review.product = :productId', { productId: product.id })
            .andWhere('review.state = :state', { state: 'approved' })
            .groupBy('ROUND(`rating`)')
            .getRawMany();
    }
};
exports.ProductEntityResolver = ProductEntityResolver;
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Api)()),
    __param(1, (0, graphql_1.Parent)()),
    __param(2, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof core_1.ApiType !== "undefined" && core_1.ApiType) === "function" ? _c : Object, typeof (_d = typeof core_1.Product !== "undefined" && core_1.Product) === "function" ? _d : Object, typeof (_e = typeof generated_shop_types_1.ProductReviewsArgs !== "undefined" && generated_shop_types_1.ProductReviewsArgs) === "function" ? _e : Object]),
    __metadata("design:returntype", void 0)
], ProductEntityResolver.prototype, "reviews", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof core_1.Product !== "undefined" && core_1.Product) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], ProductEntityResolver.prototype, "reviewsHistogram", null);
exports.ProductEntityResolver = ProductEntityResolver = __decorate([
    (0, graphql_1.Resolver)('Product'),
    __metadata("design:paramtypes", [typeof (_a = typeof core_1.ListQueryBuilder !== "undefined" && core_1.ListQueryBuilder) === "function" ? _a : Object, typeof (_b = typeof core_1.TransactionalConnection !== "undefined" && core_1.TransactionalConnection) === "function" ? _b : Object])
], ProductEntityResolver);
