import { ID, RequestContext } from '@vendure/core';
import { PaymentProfileService } from './payment-profile.service';
export declare class PaymentProfileAdminResolver {
    private service;
    constructor(service: PaymentProfileService);
    paymentProfiles(ctx: RequestContext, options?: any): Promise<import("@vendure/core").PaginatedList<import("./payment-profile.entity").PaymentProfile>>;
    paymentProfile(ctx: RequestContext, id: ID): Promise<import("./payment-profile.entity").PaymentProfile | undefined>;
    createPaymentProfile(ctx: RequestContext, input: any): Promise<import("./payment-profile.entity").PaymentProfile>;
    updatePaymentProfile(ctx: RequestContext, input: any): Promise<import("./payment-profile.entity").PaymentProfile>;
    deletePaymentProfile(ctx: RequestContext, id: ID): Promise<boolean>;
    assignPaymentProfile(ctx: RequestContext, variantIds: ID[], profileId: ID): Promise<boolean>;
}
