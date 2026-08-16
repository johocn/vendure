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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const marketplace_seller_service_1 = require("../marketplace-seller-service");
const marketplace_service_1 = require("../marketplace.service");
let ShopResolver = class ShopResolver {
    constructor(marketplaceSellerService, marketplaceService) {
        this.marketplaceSellerService = marketplaceSellerService;
        this.marketplaceService = marketplaceService;
    }
    async registerMarketplaceSeller(ctx, args) {
        try {
            const channel = await this.marketplaceSellerService.registerMarketplaceSeller(ctx, args.input);
            return {
                id: channel.id,
                code: channel.code,
                token: channel.token,
            };
        }
        catch (e) {
            if (e instanceof core_1.InternalServerError) {
                return { errorCode: 'INTERNAL_SERVER_ERROR', message: e.message };
            }
            throw e;
        }
    }
    async marketplaceProducts(ctx) {
        const products = await this.marketplaceService.getMarketplaceProducts(ctx);
        return products.map(product => {
            var _a, _b;
            return ({
                id: product.id,
                name: product.name,
                slug: product.slug,
                barcode: (_a = product.customFields.barcode) !== null && _a !== void 0 ? _a : null,
                internalCode: (_b = product.customFields.internalCode) !== null && _b !== void 0 ? _b : null,
                merchantChannel: product.customFields.merchantRef
                    ? {
                        id: product.customFields.merchantRef.id,
                        code: product.customFields.merchantRef.code,
                        name: product.customFields.merchantRef.name,
                    }
                    : null,
            });
        });
    }
};
exports.ShopResolver = ShopResolver;
__decorate([
    (0, graphql_1.Mutation)('registerMarketplaceSeller'),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopResolver.prototype, "registerMarketplaceSeller", null);
__decorate([
    (0, graphql_1.Query)('marketplaceProducts'),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], ShopResolver.prototype, "marketplaceProducts", null);
exports.ShopResolver = ShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [marketplace_seller_service_1.MarketplaceSellerService,
        marketplace_service_1.MarketplaceService])
], ShopResolver);
