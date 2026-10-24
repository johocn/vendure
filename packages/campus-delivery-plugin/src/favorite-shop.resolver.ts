import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Channel, Ctx, CustomerService, Permission, ProductVariant, RequestContext, UserInputError } from '@vendure/core';
import { DataSource } from 'typeorm';

export interface FavoriteVariant {
    variantId: string;
    channelId: string;
}

/**
 * 商家收藏（C 端常用功能）。
 * 店铺 = 渠道，收藏记录落独立表 campus_favorite_shop（customerId + channelId 唯一），
 * 因此不受当前 activeChannel 影响：在店铺渠道内点收藏、回默认渠道读列表都能用。
 * 接口均为登录态；未登录返回 NOT_LOGGED_IN，前端游客态走本地存储。
 */
@Resolver()
export class FavoriteShopResolver {
    constructor(private customerService: CustomerService, private dataSource: DataSource) {}

    @Query()
    @Allow(Permission.Authenticated)
    async campusFavoriteStores(@Ctx() ctx: RequestContext): Promise<string[]> {
        const customerId = await this.requireCustomerId(ctx);
        const rows: Array<{ channelId: number }> = await this.dataSource.query(
            `SELECT "channelId" FROM campus_favorite_shop WHERE "customerId" = $1 ORDER BY "createdAt" ASC`,
            [customerId],
        );
        return rows.map(r => String(r.channelId));
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusToggleFavoriteStore(
        @Ctx() ctx: RequestContext,
        @Args('channelId') channelId: string,
    ): Promise<string[]> {
        const customerId = await this.requireCustomerId(ctx);
        const channelPk = Number(channelId);
        if (!Number.isInteger(channelPk) || channelPk <= 0) {
            throw new UserInputError('CHANNEL_NOT_FOUND');
        }
        const channel = await this.dataSource.getRepository(Channel).findOne({ where: { id: channelPk as any } });
        if (!channel) {
            throw new UserInputError('CHANNEL_NOT_FOUND');
        }
        // 已收藏 → 删（取消）；未收藏 → 增。唯一约束兜底并发重复插入。
        // 注意：TypeORM PostgresQueryRunner 对 DELETE/UPDATE 的 raw 返回 [rows, affected]，不是 rows
        const delResult: any = await this.dataSource.query(
            `DELETE FROM campus_favorite_shop WHERE "customerId" = $1 AND "channelId" = $2 RETURNING id`,
            [customerId, channel.id],
        );
        const removedRows: Array<{ id: number }> = Array.isArray(delResult?.[0]) ? delResult[0] : delResult ?? [];
        if (!removedRows.length) {
            await this.dataSource.query(
                `INSERT INTO campus_favorite_shop ("customerId", "channelId") VALUES ($1, $2)
                 ON CONFLICT ("customerId", "channelId") DO NOTHING`,
                [customerId, channel.id],
            );
        }
        return this.campusFavoriteStores(ctx);
    }

    /** Customer 无 userId 标量，按 user 关系反查（不过滤渠道，避免店铺渠道内收藏失败） */
    private async requireCustomerId(ctx: RequestContext): Promise<number> {
        if (!ctx.activeUserId) {
            throw new UserInputError('NOT_LOGGED_IN');
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new UserInputError('CUSTOMER_NOT_FOUND');
        }
        return customer.id as unknown as number;
    }

    // ── 商品收藏（variant 粒度，跨渠道读取） ──

    @Query()
    @Allow(Permission.Authenticated)
    async campusFavoriteVariants(@Ctx() ctx: RequestContext): Promise<FavoriteVariant[]> {
        const customerId = await this.requireCustomerId(ctx);
        const rows: Array<{ variantId: number; channelId: number }> = await this.dataSource.query(
            `SELECT "variantId", "channelId" FROM campus_favorite_variant WHERE "customerId" = $1 ORDER BY "createdAt" ASC`,
            [customerId],
        );
        return rows.map(r => ({ variantId: String(r.variantId), channelId: String(r.channelId) }));
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusToggleFavoriteVariant(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: string,
        @Args('channelId') channelId: string,
    ): Promise<FavoriteVariant[]> {
        const customerId = await this.requireCustomerId(ctx);
        const variantPk = Number(variantId);
        const channelPk = Number(channelId);
        if (!Number.isInteger(variantPk) || variantPk <= 0) {
            throw new UserInputError('VARIANT_NOT_FOUND');
        }
        if (!Number.isInteger(channelPk) || channelPk <= 0) {
            throw new UserInputError('CHANNEL_NOT_FOUND');
        }
        const channel = await this.dataSource.getRepository(Channel).findOne({ where: { id: channelPk as any } });
        if (!channel) {
            throw new UserInputError('CHANNEL_NOT_FOUND');
        }
        // 归属校验：variant 必须属于所收藏的渠道，否则可跨店收藏任意商品（列表按 channelId 展示串店）
        const variant = await this.dataSource
            .getRepository(ProductVariant)
            .createQueryBuilder('variant')
            .leftJoin('variant.channels', 'channel')
            .where('variant.id = :id', { id: variantPk })
            .andWhere('channel.id = :ch', { ch: channelPk })
            .getOne();
        if (!variant) {
            throw new UserInputError('VARIANT_NOT_FOUND');
        }
        // 同商家收藏：DELETE…RETURNING 判断是否已收藏；raw 返回 [rows, affected]，兼容数组/对象两种形态
        const delResult: any = await this.dataSource.query(
            `DELETE FROM campus_favorite_variant WHERE "customerId" = $1 AND "variantId" = $2 RETURNING id`,
            [customerId, variantPk],
        );
        const removedRows: Array<{ id: number }> = Array.isArray(delResult?.[0]) ? delResult[0] : delResult ?? [];
        if (!removedRows.length) {
            await this.dataSource.query(
                `INSERT INTO campus_favorite_variant ("customerId", "channelId", "variantId") VALUES ($1, $2, $3)
                 ON CONFLICT ("customerId", "variantId") DO NOTHING`,
                [customerId, channelPk, variantPk],
            );
        }
        return this.campusFavoriteVariants(ctx);
    }
}
