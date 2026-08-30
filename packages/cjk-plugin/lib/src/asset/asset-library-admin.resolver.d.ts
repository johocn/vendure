import { RequestContext, AssetService } from '@vendure/core';
import { TransactionalConnection } from '@vendure/core';
/**
 * 按当前登录用户过滤的资产图库 + 租户级图片分类标签（assetTags）。
 * - 超管：返回全部资产；普通后台用户：仅返回 uploadedBy == 当前用户 id 的资产。
 * - uploadedBy 写入路径：前端 uploadAsset 上传时在 customFields 传当前 admin 用户 id。
 * - assetTags（分类码）挂在各 Asset 上 → 天然按 channel(租户) 隔离，不会跨租户串。
 */
export declare class AssetLibraryAdminResolver {
    private assetService;
    private connection;
    constructor(assetService: AssetService, connection: TransactionalConnection);
    assetLibrary(ctx: RequestContext, take?: number, skip?: number, tags?: string[]): Promise<{
        items: any[];
        totalItems: number;
    }>;
    /** 当前租户（普通用户则本人）可用的图片分类码清单 */
    assetTags(ctx: RequestContext, take?: number): Promise<Array<{
        name: string;
        count: number;
    }>>;
    /** 给指定图片设置分类码（整组覆盖）。仅允许操作当前 channel 下(或超管)的资产，避免跨租户越权。 */
    setAssetTags(ctx: RequestContext, assetIds: string[], tags?: string[]): Promise<boolean>;
    private loadFiltered;
    private assertOwned;
    private toAssetItem;
}
