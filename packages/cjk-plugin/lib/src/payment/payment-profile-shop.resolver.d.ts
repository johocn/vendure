import { ID, RequestContext } from '@vendure/core';
import { PaymentProfileService } from './payment-profile.service';
export declare class PaymentProfileShopResolver {
    private service;
    constructor(service: PaymentProfileService);
    eligiblePaymentMethodsByProfile(ctx: RequestContext, profileIds: ID[]): Promise<any[]>;
    eligibleInstallmentOptions(ctx: RequestContext, profileIds: ID[]): Promise<Record<string, any> | null>;
    checkPaymentProfileCompatibility(ctx: RequestContext, profileIds: ID[]): Promise<{
        compatible: boolean;
        intersectedCount: number;
    }>;
}
