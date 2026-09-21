import { ID, RequestContext } from '@vendure/core';
import { DeliveryFacetService } from './delivery-facet.service';
import { ShippingProfileService } from './shipping-profile.service';
export declare class ShippingProfileAdminResolver {
    private service;
    private deliveryFacetService;
    constructor(service: ShippingProfileService, deliveryFacetService: DeliveryFacetService);
    /**
     * facet 只是配送能力的「派生索引」，同步失败不应让档案写操作报错/回滚
     * （否则商户改一次档案就整单失败）。失败只记日志，索引由下次档案变更重建。
     */
    private syncFacetSilently;
    shippingProfiles(ctx: RequestContext, options?: any): Promise<import("@vendure/core").PaginatedList<import("./shipping-profile.entity").ShippingProfile>>;
    shippingProfile(ctx: RequestContext, id: ID): Promise<import("./shipping-profile.entity").ShippingProfile | undefined>;
    createShippingProfile(ctx: RequestContext, input: any): Promise<import("./shipping-profile.entity").ShippingProfile>;
    updateShippingProfile(ctx: RequestContext, input: any): Promise<import("./shipping-profile.entity").ShippingProfile>;
    deleteShippingProfile(ctx: RequestContext, id: ID): Promise<boolean>;
    assignShippingProfile(ctx: RequestContext, variantIds: ID[], profileId: ID): Promise<boolean>;
    setTenantDefaultShippingProfile(ctx: RequestContext, id: ID): Promise<boolean>;
}
