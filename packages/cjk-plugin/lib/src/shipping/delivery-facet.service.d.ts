import { ChannelService, FacetService, FacetValueService, ID, ProductVariantService, RequestContext, TransactionalConnection } from '@vendure/core';
import { ShippingProfileService } from './shipping-profile.service';
/** 派生配送能力所用的原生 facet code（一个 facet，两个 facet value） */
export declare const DELIVERY_FACET_CODE = "delivery-mode";
/**
 * 把「配送能力派生」结果同步到 Vendure 原生 facet（ProductVariant.facetValues），
 * 使 C 端能用原生 search 的 facetValueFilters 做服务端过滤（totalItems / 分页正确）。
 *
 * 能力真源仍是 ShippingProfileMethod.mode（见 delivery-capability.ts），facet 只是它的索引副本。
 */
export declare class DeliveryFacetService {
    private connection;
    private facetService;
    private facetValueService;
    private channelService;
    private productVariantService;
    private shippingProfileService;
    /** channelId → { MAIL: <facetValueId>, SELF_PICKUP: <facetValueId> }，避免读接口每次请求都查库 */
    private readonly facetCache;
    constructor(connection: TransactionalConnection, facetService: FacetService, facetValueService: FacetValueService, channelService: ChannelService, productVariantService: ProductVariantService, shippingProfileService: ShippingProfileService);
    /**
     * 幂等保证渠道内存在 facet 与两个 facet value，返回 { MAIL: id, SELF_PICKUP: id }。
     *
     * Facet / FacetValue 是 ChannelsAware：必须走 FacetService / FacetValueService（内部
     * assignToCurrentChannel）或 ChannelService.assignToChannels 才会分配渠道；直接
     * connection.getRepository(...).save() 不会分配，后续按渠道查询会查不到。
     */
    ensureFacet(ctx: RequestContext): Promise<Record<string, string>>;
    /** 使某渠道的 facet 缓存失效（facet 被外部改动 / 重建时使用） */
    invalidateChannel(channelId: ID): void;
    /** 重建整个渠道的配送 facet 同步（档案方法配置 / 档案增删改 / 启停 / 租户默认 变更后调用） */
    rebuildChannel(ctx: RequestContext, batchSize?: number): Promise<{
        scanned: number;
        updated: number;
    }>;
    /**
     * 把指定变体的配送 facet 同步为派生结果（保留其它 facet），返回实际更新条数。
     * 变更检测：与当前集合一致则跳过，避免无谓的搜索索引更新。
     */
    syncVariants(ctx: RequestContext, variantIds: ID[], facetIds?: Record<string, string>): Promise<number>;
}
