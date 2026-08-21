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
exports.FavoriteService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const shop_plugin_1 = require("@vendure/shop-plugin");
const constants_1 = require("./constants");
const favorite_entity_1 = require("./favorite.entity");
let FavoriteService = class FavoriteService {
    constructor(connection, customerService) {
        this.connection = connection;
        this.customerService = customerService;
    }
    /** 当前登录顾客；未登录抛 Unauthorized，无顾客记录抛 NotFound（对齐 review 口径）。 */
    async requireCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }
    // ---------- 商品收藏 ----------
    /** toggle 收藏商品：返回收藏后的状态（true=已收藏）。 */
    async toggleProductFavorite(ctx, productId) {
        const customer = await this.requireCustomer(ctx);
        // 校验商品存在
        const product = await this.connection
            .getRepository(ctx, core_1.Product)
            .findOne({ where: { id: Number(productId) } });
        if (!product) {
            throw new core_1.EntityNotFoundError('Product', productId);
        }
        const repo = this.connection.getRepository(ctx, favorite_entity_1.Favorite);
        const existing = await repo.findOne({
            where: {
                customerId: customer.id,
                productId: Number(productId),
            },
        });
        let nowFavorite;
        if (existing) {
            await repo.remove(existing);
            nowFavorite = false;
        }
        else {
            const fav = new favorite_entity_1.Favorite({
                customerId: customer.id,
                productId: Number(productId),
                shopId: null,
                channelId: ctx.channelId,
            });
            await repo.save(fav);
            nowFavorite = true;
        }
        await this.recomputeProductFavoriteCount(ctx, productId);
        core_1.Logger.verbose(`toggleProductFavorite customer=${customer.id} product=${productId} => ${nowFavorite}`, constants_1.loggerCtx);
        return nowFavorite;
    }
    /** 商品是否已被当前顾客收藏。 */
    async isProductFavorite(ctx, productId) {
        const customer = await this.requireCustomer(ctx);
        const count = await this.connection.getRepository(ctx, favorite_entity_1.Favorite).count({
            where: {
                customerId: customer.id,
                productId: Number(productId),
            },
        });
        return count > 0;
    }
    /** 当前顾客收藏的商品列表。 */
    async myFavoriteProducts(ctx) {
        const customer = await this.requireCustomer(ctx);
        const records = await this.connection.getRepository(ctx, favorite_entity_1.Favorite).find({
            where: { customerId: customer.id, channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
        });
        const productIds = records
            .filter(r => r.productId != null)
            .map(r => Number(r.productId));
        if (productIds.length === 0) {
            return [];
        }
        const products = await this.connection.getRepository(ctx, core_1.Product).find({
            where: { id: (0, typeorm_1.In)(productIds) },
        });
        // 保持收藏顺序（按 createdAt 倒序）
        return productIds
            .map(pid => products.find(p => p.id === pid))
            .filter((p) => !!p);
    }
    async recomputeProductFavoriteCount(ctx, productId) {
        const count = await this.connection.getRepository(ctx, favorite_entity_1.Favorite).count({
            where: { productId: Number(productId) },
        });
        await this.connection.getRepository(ctx, core_1.Product).update({ id: Number(productId) }, { customFields: { favoriteCount: count } });
    }
    // ---------- 店铺关注 ----------
    /** toggle 关注店铺：返回关注后的状态（true=已关注）。 */
    async toggleShopFollow(ctx, shopId) {
        const customer = await this.requireCustomer(ctx);
        // 校验店铺存在（shop-plugin 实体；缺失抛错）
        const shop = await this.connection
            .getRepository(ctx, shop_plugin_1.Shop)
            .findOne({ where: { id: Number(shopId) } });
        if (!shop) {
            throw new core_1.EntityNotFoundError('Shop', shopId);
        }
        const repo = this.connection.getRepository(ctx, favorite_entity_1.Favorite);
        const existing = await repo.findOne({
            where: {
                customerId: customer.id,
                shopId: Number(shopId),
            },
        });
        let nowFollowed;
        if (existing) {
            await repo.remove(existing);
            nowFollowed = false;
        }
        else {
            const fav = new favorite_entity_1.Favorite({
                customerId: customer.id,
                shopId: Number(shopId),
                productId: null,
                channelId: ctx.channelId,
            });
            await repo.save(fav);
            nowFollowed = true;
        }
        core_1.Logger.verbose(`toggleShopFollow customer=${customer.id} shop=${shopId} => ${nowFollowed}`, constants_1.loggerCtx);
        return nowFollowed;
    }
    /** 店铺是否已被当前顾客关注。 */
    async isShopFollowed(ctx, shopId) {
        const customer = await this.requireCustomer(ctx);
        const count = await this.connection.getRepository(ctx, favorite_entity_1.Favorite).count({
            where: {
                customerId: customer.id,
                shopId: Number(shopId),
            },
        });
        return count > 0;
    }
    /** 当前顾客关注的店铺列表（shop-plugin 实体）。 */
    async myFollowedShops(ctx) {
        const customer = await this.requireCustomer(ctx);
        const records = await this.connection.getRepository(ctx, favorite_entity_1.Favorite).find({
            where: { customerId: customer.id, channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
        });
        const shopIds = records.filter(r => r.shopId != null).map(r => Number(r.shopId));
        if (shopIds.length === 0) {
            return [];
        }
        const shops = await this.connection.getRepository(ctx, shop_plugin_1.Shop).find({
            where: { id: (0, typeorm_1.In)(shopIds) },
        });
        return shopIds
            .map(sid => shops.find(s => s.id === sid))
            .filter((s) => !!s);
    }
    /** 关注数（动态聚合，作为店铺热度展示口径；不落 shop-plugin 缓存列）。 */
    async shopFollowerCount(ctx, shopId) {
        return this.connection.getRepository(ctx, favorite_entity_1.Favorite).count({
            where: { shopId: Number(shopId) },
        });
    }
};
exports.FavoriteService = FavoriteService;
exports.FavoriteService = FavoriteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CustomerService])
], FavoriteService);
//# sourceMappingURL=favorite.service.js.map