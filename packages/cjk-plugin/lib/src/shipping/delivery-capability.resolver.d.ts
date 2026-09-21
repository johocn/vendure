import { ID, RequestContext } from '@vendure/core';
import { DeliveryFacetService } from './delivery-facet.service';
import { ShippingProfileService } from './shipping-profile.service';
/**
 * 配送能力查询（shop-api）。
 * modes/bothSupported 由配送档案派生（唯一真源），与 facet 索引无关；
 * facetValueIds 为可选的「服务端筛选入口」，facet 尚未同步时为 null（C 端据此降级为不过滤）。
 */
export declare class DeliveryCapabilityResolver {
    private shippingProfileService;
    private deliveryFacetService;
    constructor(shippingProfileService: ShippingProfileService, deliveryFacetService: DeliveryFacetService);
    channelDeliveryCapability(ctx: RequestContext): Promise<{
        modes: string[];
        bothSupported: boolean;
        source: string;
        facetValueIds: Record<string, string> | null;
    }>;
    /** 单品/多品派生能力（后台商品表单「只读展示」用） */
    variantDeliveryModes(ctx: RequestContext, variantIds: ID[]): Promise<Array<{
        variantId: string;
        modes: string[];
    }>>;
}
