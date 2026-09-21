import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Logger, Permission, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';
import { DeliveryFacetService } from './delivery-facet.service';
import { ShippingProfileService } from './shipping-profile.service';

/**
 * 配送能力查询（shop-api）。
 * modes/bothSupported 由配送档案派生（唯一真源），与 facet 索引无关；
 * facetValueIds 为可选的「服务端筛选入口」，facet 尚未同步时为 null（C 端据此降级为不过滤）。
 */
@Resolver()
export class DeliveryCapabilityResolver {
    constructor(
        private shippingProfileService: ShippingProfileService,
        private deliveryFacetService: DeliveryFacetService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async channelDeliveryCapability(@Ctx() ctx: RequestContext): Promise<{
        modes: string[];
        bothSupported: boolean;
        source: string;
        facetValueIds: Record<string, string> | null;
    }> {
        const cap = await this.shippingProfileService.getChannelDeliveryCapability(ctx);
        return {
            modes: cap.modes,
            bothSupported: cap.bothSupported,
            source: cap.source,
            // facet 同步失败时返回 null，C 端据此降级为「不过滤」，不影响首页可用性
            facetValueIds: await this.deliveryFacetService.ensureFacet(ctx).catch((e: any) => {
                Logger.warn(`配送 facet 索引不可用：${e?.message ?? e}`, loggerCtx);
                return null;
            }),
        };
    }

    /** 单品/多品派生能力（后台商品表单「只读展示」用） */
    @Query()
    @Allow(Permission.Public)
    async variantDeliveryModes(
        @Ctx() ctx: RequestContext,
        @Args('variantIds') variantIds: ID[],
    ): Promise<Array<{ variantId: string; modes: string[] }>> {
        const map = await this.shippingProfileService.getVariantDeliveryCapabilities(ctx, variantIds);
        return [...map.entries()].map(([variantId, cap]) => ({ variantId, modes: cap.modes }));
    }
}
