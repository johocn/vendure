import { ChannelService, Collection, CollectionService, ID, Product, RequestContext, TransactionalConnection, Translated } from '@vendure/core';
import { CreateCollectionInput } from '@vendure/common/lib/generated-types';
export declare class TenantCatalogService {
    private collectionService;
    private channelService;
    private connection;
    constructor(collectionService: CollectionService, channelService: ChannelService, connection: TransactionalConnection);
    /** 解析 productIds 参数值：Vendure ConfigArg 中 list 型参数以 JSON 字符串存储（如 '[60]' / '["60"]'），兼容数组。 */
    private parseIdList;
    /**
     * 创建租户分类后，主动从默认渠道摘除，实现「租户分类只挂租户渠道、进默认商城」双轨隔离。
     * 不能走 removeCollectionsFromChannel（会对默认渠道抛错），须直接 channelService.removeFromChannels。
     */
    createTenantCollection(ctx: RequestContext, input: CreateCollectionInput): Promise<Translated<Collection>>;
    /** 把商品 ID 追加进平台分类的 productId 过滤器（只增；非 productId 独过滤器则新建一条 productId 过滤器，不改其它过滤器）。 */
    addProductToCollection(ctx: RequestContext, productId: ID, collectionId: ID): Promise<void>;
    /**
     * 把商品挂到租户渠道并从默认渠道摘除（双轨隔离）。
     * 不能走 removeProductsFromChannel（会被「默认渠道不可摘除」守卫拦），须直接 channelService.removeFromChannels。
     */
    moveProductsToTenantChannel(ctx: RequestContext, productIds: ID[], channelId: ID): Promise<Product[]>;
}
