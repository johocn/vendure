import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Allow, Ctx, Permission, RequestContext, AssetService, UserInputError } from '@vendure/core';
import { Asset, TransactionalConnection } from '@vendure/core';

/**
 * 按当前登录用户过滤的资产图库 + 租户级图片分类标签（assetTags）。
 * - 超管：返回全部资产；普通后台用户：仅返回 uploadedBy == 当前用户 id 的资产。
 * - uploadedBy 写入路径：前端 uploadAsset 上传时在 customFields 传当前 admin 用户 id。
 * - assetTags（分类码）挂在各 Asset 上 → 天然按 channel(租户) 隔离，不会跨租户串。
 */
@Resolver()
export class AssetLibraryAdminResolver {
    constructor(
        @Inject(AssetService) private assetService: AssetService,
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
    ) {}

    @Query()
    @Allow(Permission.Authenticated)
    async assetLibrary(
        @Ctx() ctx: RequestContext,
        @Args('take', { type: () => Number, nullable: true }) take = 30,
        @Args('skip', { type: () => Number, nullable: true }) skip = 0,
        @Args('tags', { type: () => [String], nullable: true }) tags?: string[],
    ): Promise<{ items: any[]; totalItems: number }> {
        const filtered = await this.loadFiltered(ctx);
        const cleanTags = (tags || []).map((t) => String(t).trim()).filter(Boolean);
        const finalList = cleanTags.length
            ? filtered.filter((a: any) => {
                  const assetTags: string[] = (a.customFields as any)?.assetTags || [];
                  return assetTags.some((t) => cleanTags.includes(t));
              })
            : filtered;

        const total = finalList.length;
        const slice = finalList.slice(skip, skip + take);
        return {
            items: slice.map((a) => this.toAssetItem(a)),
            totalItems: total,
        };
    }

    /** 当前租户（普通用户则本人）可用的图片分类码清单 */
    @Query()
    @Allow(Permission.Authenticated)
    async assetTags(
        @Ctx() ctx: RequestContext,
        @Args('take', { type: () => Number, nullable: true }) take = 100,
    ): Promise<Array<{ name: string; count: number }>> {
        const filtered = await this.loadFiltered(ctx);
        const agg = new Map<string, number>();
        for (const a of filtered) {
            const tags: string[] = (a.customFields as any)?.assetTags || [];
            for (const t of tags) {
                const k = String(t);
                if (k) agg.set(k, (agg.get(k) || 0) + 1);
            }
        }
        const list = Array.from(agg.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((x, y) => y.count - x.count);
        return list.slice(0, take);
    }

    /** 给指定图片设置分类码（整组覆盖）。仅允许操作当前 channel 下(或超管)的资产，避免跨租户越权。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async setAssetTags(
        @Ctx() ctx: RequestContext,
        @Args('assetIds', { type: () => [String] }) assetIds: string[],
        @Args('tags', { type: () => [String], nullable: true }) tags?: string[],
    ): Promise<boolean> {
        const clean = (tags || []).map((t) => String(t).trim()).filter(Boolean);
        const repo = this.connection.getRepository(ctx, Asset);
        for (const id of assetIds) {
            const asset = await repo.findOne({ where: { id: String(id) as any }, relations: ['channels'] });
            if (!asset) continue;
            this.assertOwned(ctx, asset);
            asset.customFields = { ...(asset.customFields || {}), assetTags: clean };
            await repo.save(asset);
        }
        return true;
    }

    private async loadFiltered(ctx: RequestContext): Promise<Asset[]> {
        const user: any = (ctx as any).session?.user;
        const channelPerms: any[] = user?.channelPermissions || [];
        const isSuperAdmin =
            user?.superAdmin === true ||
            channelPerms.some((cp: any) => (cp.permissions || []).includes(Permission.SuperAdmin));

        // 拉取该渠道全部资产，再按上传者过滤 —— 避免跨库 JSON 过滤副作用
        const all = await this.assetService.findAll(ctx, {
            take: 100000,
            sort: { createdAt: 'DESC' as any },
        });
        let filtered = all.items;
        if (!isSuperAdmin) {
            const mine = String(user?.id ?? '');
            filtered = all.items.filter((a: any) => String(a.customFields?.uploadedBy ?? '') === mine);
        }
        return filtered;
    }

    private assertOwned(ctx: RequestContext, asset: Asset): void {
        const user: any = (ctx as any).session?.user;
        const channelPerms: any[] = user?.channelPermissions || [];
        const isSuperAdmin =
            user?.superAdmin === true ||
            channelPerms.some((cp: any) => (cp.permissions || []).includes(Permission.SuperAdmin));
        if (isSuperAdmin) return;
        const inChannel = (asset.channels || []).some(
            (c) => String(c.id) === String((ctx as any).channelId),
        );
        if (!inChannel) {
            throw new UserInputError('不能操作不属于当前店铺的图片');
        }
    }

    private toAssetItem(a: Asset): any {
        return {
            id: String(a.id),
            name: a.name || '',
            preview: a.preview,
            source: a.source,
            mimeType: a.mimeType,
            width: a.width,
            height: a.height,
            assetTags: (a.customFields as any)?.assetTags || [],
        };
    }
}