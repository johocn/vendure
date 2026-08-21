import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    EntityNotFoundError,
    ID,
    Logger,
    Product,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
} from '@vendure/core';
import { In } from 'typeorm';

import { Shop } from '@vendure/shop-plugin';

import { loggerCtx } from './constants';
import { Favorite } from './favorite.entity';

@Injectable()
export class FavoriteService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
    ) {}

    /** 当前登录顾客；未登录抛 Unauthorized，无顾客记录抛 NotFound（对齐 review 口径）。 */
    private async requireCustomer(ctx: RequestContext): Promise<any> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }

    // ---------- 商品收藏 ----------

    /** toggle 收藏商品：返回收藏后的状态（true=已收藏）。 */
    async toggleProductFavorite(ctx: RequestContext, productId: ID): Promise<boolean> {
        const customer = await this.requireCustomer(ctx);
        // 校验商品存在
        const product = await this.connection
            .getRepository(ctx, Product)
            .findOne({ where: { id: Number(productId) } as any });
        if (!product) {
            throw new EntityNotFoundError('Product', productId);
        }

        const repo = this.connection.getRepository(ctx, Favorite);
        const existing = await repo.findOne({
            where: {
                customerId: customer.id,
                productId: Number(productId),
            } as any,
        });

        let nowFavorite: boolean;
        if (existing) {
            await repo.remove(existing);
            nowFavorite = false;
        } else {
            const fav = new Favorite({
                customerId: customer.id,
                productId: Number(productId),
                shopId: null,
                channelId: ctx.channelId as number,
            } as any);
            await repo.save(fav);
            nowFavorite = true;
        }

        await this.recomputeProductFavoriteCount(ctx, productId);
        Logger.verbose(
            `toggleProductFavorite customer=${customer.id} product=${productId} => ${nowFavorite}`,
            loggerCtx,
        );
        return nowFavorite;
    }

    /** 商品是否已被当前顾客收藏。 */
    async isProductFavorite(ctx: RequestContext, productId: ID): Promise<boolean> {
        const customer = await this.requireCustomer(ctx);
        const count = await this.connection.getRepository(ctx, Favorite).count({
            where: {
                customerId: customer.id,
                productId: Number(productId),
            } as any,
        });
        return count > 0;
    }

    /** 当前顾客收藏的商品列表。 */
    async myFavoriteProducts(ctx: RequestContext): Promise<Product[]> {
        const customer = await this.requireCustomer(ctx);
        const records = await this.connection.getRepository(ctx, Favorite).find({
            where: { customerId: customer.id, channelId: ctx.channelId as number } as any,
            order: { createdAt: 'DESC' },
        });
        const productIds = records
            .filter(r => r.productId != null)
            .map(r => Number(r.productId));
        if (productIds.length === 0) {
            return [];
        }
        const products = await this.connection.getRepository(ctx, Product).find({
            where: { id: In(productIds) } as any,
        });
        // 保持收藏顺序（按 createdAt 倒序）
        return productIds
            .map(pid => products.find(p => (p.id as number) === pid))
            .filter((p): p is Product => !!p);
    }

    private async recomputeProductFavoriteCount(ctx: RequestContext, productId: ID): Promise<void> {
        const count = await this.connection.getRepository(ctx, Favorite).count({
            where: { productId: Number(productId) } as any,
        });
        await this.connection.getRepository(ctx, Product).update(
            { id: Number(productId) } as any,
            { customFields: { favoriteCount: count } } as any,
        );
    }

    // ---------- 店铺关注 ----------

    /** toggle 关注店铺：返回关注后的状态（true=已关注）。 */
    async toggleShopFollow(ctx: RequestContext, shopId: ID): Promise<boolean> {
        const customer = await this.requireCustomer(ctx);
        // 校验店铺存在（shop-plugin 实体；缺失抛错）
        const shop = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { id: Number(shopId) } as any });
        if (!shop) {
            throw new EntityNotFoundError('Shop', shopId);
        }

        const repo = this.connection.getRepository(ctx, Favorite);
        const existing = await repo.findOne({
            where: {
                customerId: customer.id,
                shopId: Number(shopId),
            } as any,
        });

        let nowFollowed: boolean;
        if (existing) {
            await repo.remove(existing);
            nowFollowed = false;
        } else {
            const fav = new Favorite({
                customerId: customer.id,
                shopId: Number(shopId),
                productId: null,
                channelId: ctx.channelId as number,
            } as any);
            await repo.save(fav);
            nowFollowed = true;
        }

        Logger.verbose(
            `toggleShopFollow customer=${customer.id} shop=${shopId} => ${nowFollowed}`,
            loggerCtx,
        );
        return nowFollowed;
    }

    /** 店铺是否已被当前顾客关注。 */
    async isShopFollowed(ctx: RequestContext, shopId: ID): Promise<boolean> {
        const customer = await this.requireCustomer(ctx);
        const count = await this.connection.getRepository(ctx, Favorite).count({
            where: {
                customerId: customer.id,
                shopId: Number(shopId),
            } as any,
        });
        return count > 0;
    }

    /** 当前顾客关注的店铺列表（shop-plugin 实体）。 */
    async myFollowedShops(ctx: RequestContext): Promise<any[]> {
        const customer = await this.requireCustomer(ctx);
        const records = await this.connection.getRepository(ctx, Favorite).find({
            where: { customerId: customer.id, channelId: ctx.channelId as number } as any,
            order: { createdAt: 'DESC' },
        });
        const shopIds = records.filter(r => r.shopId != null).map(r => Number(r.shopId));
        if (shopIds.length === 0) {
            return [];
        }
        const shops = await this.connection.getRepository(ctx, Shop).find({
            where: { id: In(shopIds) } as any,
        });
        return shopIds
            .map(sid => shops.find(s => (s.id as number) === sid))
            .filter((s): s is any => !!s);
    }

    /** 关注数（动态聚合，作为店铺热度展示口径；不落 shop-plugin 缓存列）。 */
    async shopFollowerCount(ctx: RequestContext, shopId: ID): Promise<number> {
        return this.connection.getRepository(ctx, Favorite).count({
            where: { shopId: Number(shopId) } as any,
        });
    }
}