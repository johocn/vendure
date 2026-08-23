import { ID, RequestContext } from '@vendure/core';
import { ShippingProfileService } from './shipping-profile.service';
export declare class ShippingProfileAdminResolver {
    private service;
    constructor(service: ShippingProfileService);
    shippingProfiles(ctx: RequestContext, options?: any): Promise<import("@vendure/core").PaginatedList<import("./shipping-profile.entity").ShippingProfile>>;
    shippingProfile(ctx: RequestContext, id: ID): Promise<import("./shipping-profile.entity").ShippingProfile | undefined>;
    createShippingProfile(ctx: RequestContext, input: any): Promise<import("./shipping-profile.entity").ShippingProfile>;
    updateShippingProfile(ctx: RequestContext, input: any): Promise<import("./shipping-profile.entity").ShippingProfile>;
    deleteShippingProfile(ctx: RequestContext, id: ID): Promise<boolean>;
    assignShippingProfile(ctx: RequestContext, variantIds: ID[], profileId: ID): Promise<boolean>;
    setTenantDefaultShippingProfile(ctx: RequestContext, id: ID): Promise<boolean>;
}
