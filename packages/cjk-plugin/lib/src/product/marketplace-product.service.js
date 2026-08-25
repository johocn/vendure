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
exports.MarketplaceProductService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
let MarketplaceProductService = class MarketplaceProductService {
    constructor(productService, connection) {
        this.productService = productService;
        this.connection = connection;
    }
    /** 提审：marketplaceStatus → pending */
    async submitToMarketplace(ctx, productId) {
        var _a;
        const product = await this.productService.findOne(ctx, productId, ['featuredAsset']);
        if (!product) {
            throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
        }
        const status = (_a = product.customFields) === null || _a === void 0 ? void 0 : _a.marketplaceStatus;
        if (status === 'approved') {
            throw new Error('PRODUCT_ALREADY_APPROVED');
        }
        return this.productService.update(ctx, {
            id: productId,
            customFields: {
                listedInMarketplace: false,
                marketplaceStatus: 'pending',
            },
        });
    }
    /** 审核：approve=true → approved+listed；approve=false → rejected+reason */
    async review(ctx, productId, approve, rejectReason) {
        const product = await this.productService.findOne(ctx, productId);
        if (!product) {
            throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
        }
        if (approve) {
            return this.productService.update(ctx, {
                id: productId,
                customFields: {
                    listedInMarketplace: true,
                    marketplaceStatus: 'approved',
                    rejectReason: null,
                },
            });
        }
        return this.productService.update(ctx, {
            id: productId,
            customFields: {
                listedInMarketplace: false,
                marketplaceStatus: 'rejected',
                rejectReason: rejectReason !== null && rejectReason !== void 0 ? rejectReason : null,
            },
        });
    }
    /** 跨租户按状态查询（含审批信息的精简视图）。status 为空查全部（含未提审），保证平台可对未提审商品发起「提审」。 */
    async findByStatus(ctx, status) {
        const qb = this.connection
            .getRepository(ctx, core_1.Product)
            .createQueryBuilder('product')
            .leftJoinAndSelect('product.translations', 'translations')
            .leftJoinAndSelect('product.featuredAsset', 'featuredAsset')
            .take(500);
        if (status) {
            qb.andWhere('product.customFieldsMarketplacestatus = :s', { s: status });
        }
        const rows = (await qb.getMany());
        return rows.map((r) => this.toView(ctx, r));
    }
    /** 按 id 精确取单个审批视图（提审/审核后回显用） */
    async findOneView(ctx, productId) {
        const product = await this.productService.findOne(ctx, productId, ['featuredAsset', 'translations']);
        if (!product)
            throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
        return this.toView(ctx, product);
    }
    toView(ctx, r) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return {
            id: r.id,
            name: (_c = (_b = (_a = r.translations) === null || _a === void 0 ? void 0 : _a.find((t) => t.languageCode === ctx.languageCode || t.languageCode === 'zh_Hans')) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : r.id,
            listedInMarketplace: !!((_d = r.customFields) === null || _d === void 0 ? void 0 : _d.listedInMarketplace),
            marketplaceStatus: (_f = (_e = r.customFields) === null || _e === void 0 ? void 0 : _e.marketplaceStatus) !== null && _f !== void 0 ? _f : null,
            merchantRef: (_h = (_g = r.customFields) === null || _g === void 0 ? void 0 : _g.merchantRef) !== null && _h !== void 0 ? _h : null,
            rejectReason: (_k = (_j = r.customFields) === null || _j === void 0 ? void 0 : _j.rejectReason) !== null && _k !== void 0 ? _k : null,
        };
    }
};
exports.MarketplaceProductService = MarketplaceProductService;
exports.MarketplaceProductService = MarketplaceProductService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ProductService,
        core_1.TransactionalConnection])
], MarketplaceProductService);
//# sourceMappingURL=marketplace-product.service.js.map