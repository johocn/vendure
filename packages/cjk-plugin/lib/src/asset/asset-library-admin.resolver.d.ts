import { RequestContext, AssetService } from '@vendure/core';
import { TransactionalConnection } from '@vendure/core';
/**
 * 按当前登录用户过滤的资产图库。
 * - 超管：返回全部资产
 * - 普通后台用户：仅返回 uploadedBy == 当前用户 id 的资产（用户只看到自己上传的媒体，参照课程后台语义）
 * uploadedBy 写入路径：前端 uploadAsset 上传时在 customFields 传当前 admin 用户 id。
 */
export declare class AssetLibraryAdminResolver {
    private assetService;
    private connection;
    constructor(assetService: AssetService, connection: TransactionalConnection);
    assetLibrary(ctx: RequestContext, take?: number, skip?: number): Promise<{
        items: any[];
        totalItems: number;
    }>;
    private toAssetItem;
}
