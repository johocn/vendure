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
exports.ShopService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shop_entity_1 = require("./shop.entity");
/** 店铺状态合法迁移。single-direction：applicant→active→closed，允许重开/复审。 */
const ALLOWED_TRANSITIONS = {
    applicant: ['active', 'closed'],
    active: ['closed', 'applicant'],
    closed: ['active', 'applicant'],
};
let ShopService = class ShopService {
    constructor(connection, productService) {
        this.connection = connection;
        this.productService = productService;
    }
    // ---------- 管理端 ----------
    async createShop(ctx, input) {
        var _a;
        await this.assertSlugUnique(ctx, input.slug);
        const repo = this.connection.getRepository(ctx, shop_entity_1.Shop);
        const existing = await repo.findOne({ where: { slug: input.slug } });
        if (existing) {
            throw new core_1.UserInputError(`Slug "${input.slug}" already in use`);
        }
        const shop = new shop_entity_1.Shop({
            name: input.name,
            slug: input.slug,
            logoAssetId: input.logoAssetId != null ? Number(input.logoAssetId) : null,
            bannerAssetId: input.bannerAssetId != null ? Number(input.bannerAssetId) : null,
            description: (_a = input.description) !== null && _a !== void 0 ? _a : null,
            status: 'applicant',
            channelId: ctx.channelId,
        });
        shop.channels = [ctx.channel];
        return repo.save(shop);
    }
    async updateShop(ctx, id, input) {
        var _a;
        const shop = await this.getEntityOrThrow(ctx, id);
        if (input.slug != null && input.slug !== shop.slug) {
            await this.assertSlugUnique(ctx, input.slug, id);
            shop.slug = input.slug;
        }
        if (input.name != null)
            shop.name = input.name;
        if (input.logoAssetId !== undefined) {
            shop.logoAssetId = input.logoAssetId != null ? Number(input.logoAssetId) : null;
        }
        if (input.bannerAssetId !== undefined) {
            shop.bannerAssetId = input.bannerAssetId != null ? Number(input.bannerAssetId) : null;
        }
        if (input.description !== undefined)
            shop.description = (_a = input.description) !== null && _a !== void 0 ? _a : null;
        return this.connection.getRepository(ctx, shop_entity_1.Shop).save(shop);
    }
    async setShopStatus(ctx, id, status) {
        var _a;
        const shop = await this.getEntityOrThrow(ctx, id);
        if (!status || !['applicant', 'active', 'closed'].includes(status)) {
            throw new core_1.UserInputError(`Invalid shop status "${status}"`);
        }
        const allowed = (_a = ALLOWED_TRANSITIONS[shop.status]) !== null && _a !== void 0 ? _a : [];
        if (!allowed.includes(status)) {
            throw new core_1.UserInputError(`Cannot transition shop status from "${shop.status}" to "${status}"`);
        }
        shop.status = status;
        const saved = await this.connection.getRepository(ctx, shop_entity_1.Shop).save(shop);
        await this.recomputeShopRating(ctx, saved.id);
        return saved;
    }
    async assignProductsToShop(ctx, input) {
        var _a;
        const shopId = Number(input.shopId);
        await this.getEntityOrThrow(ctx, shopId);
        const repo = this.connection.getRepository(ctx, core_1.Product);
        for (const pid of input.productIds) {
            const product = await repo.findOne({ where: { id: Number(pid) } });
            if (!product) {
                throw new core_1.EntityNotFoundError('Product', pid);
            }
            product.customFields = Object.assign(Object.assign({}, ((_a = product.customFields) !== null && _a !== void 0 ? _a : {})), { shopId });
            await repo.save(product);
        }
        await this.recomputeShopRating(ctx, shopId);
        return true;
    }
    async unassignProductsFromShop(ctx, input) {
        var _a;
        const shopId = Number(input.shopId);
        const repo = this.connection.getRepository(ctx, core_1.Product);
        for (const pid of input.productIds) {
            const product = await repo.findOne({ where: { id: Number(pid) } });
            if (!product)
                continue;
            product.customFields = Object.assign(Object.assign({}, ((_a = product.customFields) !== null && _a !== void 0 ? _a : {})), { shopId: null });
            await repo.save(product);
        }
        await this.recomputeShopRating(ctx, shopId);
        return true;
    }
    /** 管理端列表（全部状态）。 */
    async shops(ctx, options) {
        return this.connection.getRepository(ctx, shop_entity_1.Shop).find({
            where: { channelId: ctx.channelId },
            skip: options === null || options === void 0 ? void 0 : options.skip,
            take: options === null || options === void 0 ? void 0 : options.take,
            order: { createdAt: 'ASC' },
        });
    }
    async getShop(ctx, id) {
        return this.getEntityOrThrow(ctx, id);
    }
    // ---------- C 端 ----------
    /** C 端列表：仅 active 店铺。 */
    async getActiveShops(ctx, options) {
        return this.connection.getRepository(ctx, shop_entity_1.Shop).find({
            where: { channelId: ctx.channelId, status: 'active' },
            skip: options === null || options === void 0 ? void 0 : options.skip,
            take: options === null || options === void 0 ? void 0 : options.take,
            order: { createdAt: 'ASC' },
        });
    }
    /** C 端店铺主页：仅 active 对外；slug 不存在或非 active 返回 undefined（Query 返回 nullable）。 */
    async getShopBySlug(ctx, slug) {
        const shop = await this.connection
            .getRepository(ctx, shop_entity_1.Shop)
            .findOne({ where: { slug, status: 'active' } });
        return shop !== null && shop !== void 0 ? shop : undefined;
    }
    /** 店铺商品分页列表：按 Product.customFields.shopId 过滤（marketplace 同款写法）。 */
    async getShopProducts(ctx, shopId, options) {
        const lookupId = Number(shopId);
        const [items, totalItems] = await this.connection
            .getRepository(ctx, core_1.Product)
            .findAndCount({
            where: { customFields: { shopId: lookupId } },
            skip: options === null || options === void 0 ? void 0 : options.skip,
            take: options === null || options === void 0 ? void 0 : options.take,
            order: { id: 'ASC' },
        });
        return { items, totalItems };
    }
    /** 店铺评分（实时口径）：聚合归属商品的 reviewRating/reviewCount。始终正确。 */
    async getShopRating(ctx, shopId) {
        var _a, _b, _c;
        const products = await this.connection.getRepository(ctx, core_1.Product).find({
            where: { customFields: { shopId: Number(shopId) } },
        });
        const productCount = products.length;
        let reviewCount = 0;
        let weightedSum = 0;
        for (const p of products) {
            const cf = ((_a = p.customFields) !== null && _a !== void 0 ? _a : {});
            const rc = (_b = cf.reviewCount) !== null && _b !== void 0 ? _b : 0;
            const rating = (_c = cf.reviewRating) !== null && _c !== void 0 ? _c : 0;
            reviewCount += rc;
            weightedSum += rating * rc;
        }
        const rating = reviewCount === 0 ? 0 : Math.round((weightedSum / reviewCount) * 10) / 10;
        return { rating, reviewCount, productCount };
    }
    /** 重算店铺评分并写回 Shop 缓存列（列表/店铺页读取，避免 N+1）。 */
    async recomputeShopRating(ctx, shopId) {
        const shop = await this.getEntityOrThrow(ctx, shopId);
        const snapshot = await this.getShopRating(ctx, shopId);
        shop.shopRating = snapshot.rating;
        shop.shopReviewCount = snapshot.reviewCount;
        shop.shopProductCount = snapshot.productCount;
        return this.connection.getRepository(ctx, shop_entity_1.Shop).save(shop);
    }
    /** 读店铺缓存评分（供 ResolveField）；无缓存时回退实时计算。 */
    async getShopRatingCachedOrCompute(ctx, shop) {
        var _a, _b;
        if (shop.shopRating != null) {
            return {
                rating: shop.shopRating,
                reviewCount: (_a = shop.shopReviewCount) !== null && _a !== void 0 ? _a : 0,
                productCount: (_b = shop.shopProductCount) !== null && _b !== void 0 ? _b : 0,
            };
        }
        return this.getShopRating(ctx, shop.id);
    }
    async assertSlugUnique(ctx, slug, excludeId) {
        const existing = await this.connection
            .getRepository(ctx, shop_entity_1.Shop)
            .findOne({ where: { slug } });
        if (existing && (!excludeId || existing.id !== Number(excludeId))) {
            throw new core_1.UserInputError(`Slug "${slug}" already in use`);
        }
    }
    async getEntityOrThrow(ctx, id) {
        return this.connection.getEntityOrThrow(ctx, shop_entity_1.Shop, id);
    }
};
exports.ShopService = ShopService;
exports.ShopService = ShopService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ProductService])
], ShopService);
//# sourceMappingURL=shop.service.js.map