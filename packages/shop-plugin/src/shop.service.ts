import { Injectable } from '@nestjs/common';
import {
    EntityNotFoundError,
    ID,
    PaginatedList,
    Product,
    ProductService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { Shop } from './shop.entity';
import {
    AssignProductsInput,
    CreateShopInput,
    ShopListOptions,
    ShopRating,
    ShopStatus,
    UpdateShopInput,
} from './types';

/** 店铺状态合法迁移。single-direction：applicant→active→closed，允许重开/复审。 */
const ALLOWED_TRANSITIONS: Record<string, ShopStatus[]> = {
    applicant: ['active', 'closed'],
    active: ['closed', 'applicant'],
    closed: ['active', 'applicant'],
};

@Injectable()
export class ShopService {
    constructor(
        private connection: TransactionalConnection,
        private productService: ProductService,
    ) {}

    // ---------- 管理端 ----------

    async createShop(ctx: RequestContext, input: CreateShopInput): Promise<Shop> {
        await this.assertSlugUnique(ctx, input.slug);
        const repo = this.connection.getRepository(ctx, Shop);
        const existing = await repo.findOne({ where: { slug: input.slug } as any });
        if (existing) {
            throw new UserInputError(`Slug "${input.slug}" already in use`);
        }
        const shop = new Shop({
            name: input.name,
            slug: input.slug,
            logoAssetId: input.logoAssetId != null ? Number(input.logoAssetId) : null,
            bannerAssetId: input.bannerAssetId != null ? Number(input.bannerAssetId) : null,
            description: input.description ?? null,
            status: 'applicant',
            channelId: ctx.channelId as number,
        } as any);
        shop.channels = [ctx.channel];
        return repo.save(shop);
    }

    async updateShop(ctx: RequestContext, id: ID, input: UpdateShopInput): Promise<Shop> {
        const shop = await this.getEntityOrThrow(ctx, id);
        if (input.slug != null && input.slug !== shop.slug) {
            await this.assertSlugUnique(ctx, input.slug, id);
            shop.slug = input.slug;
        }
        if (input.name != null) shop.name = input.name;
        if (input.logoAssetId !== undefined) {
            shop.logoAssetId = input.logoAssetId != null ? Number(input.logoAssetId) : null;
        }
        if (input.bannerAssetId !== undefined) {
            shop.bannerAssetId = input.bannerAssetId != null ? Number(input.bannerAssetId) : null;
        }
        if (input.description !== undefined) shop.description = input.description ?? null;
        return this.connection.getRepository(ctx, Shop).save(shop);
    }

    async setShopStatus(ctx: RequestContext, id: ID, status: ShopStatus): Promise<Shop> {
        const shop = await this.getEntityOrThrow(ctx, id);
        if (!status || !['applicant', 'active', 'closed'].includes(status)) {
            throw new UserInputError(`Invalid shop status "${status}"`);
        }
        const allowed = ALLOWED_TRANSITIONS[shop.status] ?? [];
        if (!allowed.includes(status)) {
            throw new UserInputError(`Cannot transition shop status from "${shop.status}" to "${status}"`);
        }
        shop.status = status;
        const saved = await this.connection.getRepository(ctx, Shop).save(shop);
        await this.recomputeShopRating(ctx, saved.id as number);
        return saved;
    }

    async assignProductsToShop(ctx: RequestContext, input: AssignProductsInput): Promise<boolean> {
        const shopId = Number(input.shopId);
        await this.getEntityOrThrow(ctx, shopId);
        const repo = this.connection.getRepository(ctx, Product);
        for (const pid of input.productIds) {
            const product = await repo.findOne({ where: { id: Number(pid) } as any });
            if (!product) {
                throw new EntityNotFoundError('Product', pid);
            }
            product.customFields = {
                ...(product.customFields ?? {}),
                shopId,
            } as any;
            await repo.save(product);
        }
        await this.recomputeShopRating(ctx, shopId);
        return true;
    }

    async unassignProductsFromShop(ctx: RequestContext, input: AssignProductsInput): Promise<boolean> {
        const shopId = Number(input.shopId);
        const repo = this.connection.getRepository(ctx, Product);
        for (const pid of input.productIds) {
            const product = await repo.findOne({ where: { id: Number(pid) } as any });
            if (!product) continue;
            product.customFields = {
                ...(product.customFields ?? {}),
                shopId: null,
            } as any;
            await repo.save(product);
        }
        await this.recomputeShopRating(ctx, shopId);
        return true;
    }

    /** 管理端列表（全部状态）。 */
    async shops(ctx: RequestContext, options?: ShopListOptions): Promise<Shop[]> {
        return this.connection.getRepository(ctx, Shop).find({
            where: { channelId: ctx.channelId as number } as any,
            skip: options?.skip,
            take: options?.take,
            order: { createdAt: 'ASC' },
        });
    }

    async getShop(ctx: RequestContext, id: ID): Promise<Shop> {
        return this.getEntityOrThrow(ctx, id);
    }

    // ---------- C 端 ----------

    /** C 端列表：仅 active 店铺。 */
    async getActiveShops(ctx: RequestContext, options?: ShopListOptions): Promise<Shop[]> {
        return this.connection.getRepository(ctx, Shop).find({
            where: { channelId: ctx.channelId as number, status: 'active' } as any,
            skip: options?.skip,
            take: options?.take,
            order: { createdAt: 'ASC' },
        });
    }

    /** C 端店铺主页：仅 active 对外；slug 不存在或非 active 返回 undefined（Query 返回 nullable）。 */
    async getShopBySlug(ctx: RequestContext, slug: string): Promise<Shop | undefined> {
        const shop = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { slug, status: 'active' } as any });
        return shop ?? undefined;
    }

    /** 店铺商品分页列表：按 Product.customFields.shopId 过滤（marketplace 同款写法）。 */
    async getShopProducts(
        ctx: RequestContext,
        shopId: ID,
        options?: ShopListOptions,
    ): Promise<PaginatedList<Product>> {
        const lookupId = Number(shopId);
        const [items, totalItems] = await this.connection
            .getRepository(ctx, Product)
            .findAndCount({
                where: { customFields: { shopId: lookupId } as any },
                skip: options?.skip,
                take: options?.take,
                order: { id: 'ASC' },
            });
        return { items, totalItems };
    }

    /** 店铺评分（实时口径）：聚合归属商品的 reviewRating/reviewCount。始终正确。 */
    async getShopRating(ctx: RequestContext, shopId: ID): Promise<ShopRating> {
        const products = await this.connection.getRepository(ctx, Product).find({
            where: { customFields: { shopId: Number(shopId) } as any },
        });
        const productCount = products.length;
        let reviewCount = 0;
        let weightedSum = 0;
        for (const p of products) {
            const cf = (p.customFields ?? {}) as any;
            const rc = cf.reviewCount ?? 0;
            const rating = cf.reviewRating ?? 0;
            reviewCount += rc;
            weightedSum += rating * rc;
        }
        const rating = reviewCount === 0 ? 0 : Math.round((weightedSum / reviewCount) * 10) / 10;
        return { rating, reviewCount, productCount };
    }

    /** 重算店铺评分并写回 Shop 缓存列（列表/店铺页读取，避免 N+1）。 */
    async recomputeShopRating(ctx: RequestContext, shopId: ID): Promise<Shop> {
        const shop = await this.getEntityOrThrow(ctx, shopId);
        const snapshot = await this.getShopRating(ctx, shopId);
        shop.shopRating = snapshot.rating;
        shop.shopReviewCount = snapshot.reviewCount;
        shop.shopProductCount = snapshot.productCount;
        return this.connection.getRepository(ctx, Shop).save(shop);
    }

    /** 读店铺缓存评分（供 ResolveField）；无缓存时回退实时计算。 */
    async getShopRatingCachedOrCompute(ctx: RequestContext, shop: Shop): Promise<ShopRating> {
        if (shop.shopRating != null) {
            return {
                rating: shop.shopRating,
                reviewCount: shop.shopReviewCount ?? 0,
                productCount: shop.shopProductCount ?? 0,
            };
        }
        return this.getShopRating(ctx, shop.id as number);
    }

    private async assertSlugUnique(ctx: RequestContext, slug: string, excludeId?: ID): Promise<void> {
        const existing = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { slug } as any });
        if (existing && (!excludeId || existing.id !== Number(excludeId))) {
            throw new UserInputError(`Slug "${slug}" already in use`);
        }
    }

    private async getEntityOrThrow(ctx: RequestContext, id: ID): Promise<Shop> {
        return this.connection.getEntityOrThrow(ctx, Shop, id);
    }
}