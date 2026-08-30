import { Args, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Allow, Ctx, Permission, RequestContext, AssetService } from '@vendure/core';
import { Asset, TransactionalConnection } from '@vendure/core';

/**
 * 按当前登录用户过滤的资产图库。
 * - 超管：返回全部资产
 * - 普通后台用户：仅返回 uploadedBy == 当前用户 id 的资产（用户只看到自己上传的媒体，参照课程后台语义）
 * uploadedBy 写入路径：前端 uploadAsset 上传时在 customFields 传当前 admin 用户 id。
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
    ): Promise<{ items: any[]; totalItems: number }> {
        const user: any = (ctx as any).session?.user;
        const channelPerms: any[] = user?.channelPermissions || [];
        const isSuperAdmin =
            user?.superAdmin === true ||
            channelPerms.some((cp: any) => (cp.permissions || []).includes(Permission.SuperAdmin));

        // 拉取该渠道全部资产（图库规模可控），再按上传者过滤 —— 避免跨库 JSON 过滤副作用
        const all = await this.assetService.findAll(ctx, {
            take: 100000,
            sort: { createdAt: 'DESC' as any },
        });

        let filtered = all.items;
        if (!isSuperAdmin) {
            const mine = String(user?.id ?? '');
            filtered = all.items.filter((a: any) => String(a.customFields?.uploadedBy ?? '') === mine);
        }

        const total = filtered.length;
        const slice = filtered.slice(skip, skip + take);
        return {
            items: slice.map((a) => this.toAssetItem(a)),
            totalItems: total,
        };
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
        };
    }
}