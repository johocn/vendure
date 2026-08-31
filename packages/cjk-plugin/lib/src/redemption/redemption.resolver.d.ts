import { ConfigService, OrderService, RequestContext } from '@vendure/core';
import { RedemptionCodeService } from './redemption-code.service';
export declare class RedemptionShopResolver {
    private redemptionCodeService;
    private orderService;
    private configService;
    constructor(redemptionCodeService: RedemptionCodeService, orderService: OrderService, configService: ConfigService);
    orderRedemptionCode(ctx: RequestContext, input: {
        orderCode: string;
        phone?: string;
    }): Promise<any>;
}
export declare class RedemptionAdminResolver {
    private redemptionCodeService;
    private orderService;
    constructor(redemptionCodeService: RedemptionCodeService, orderService: OrderService);
    redemptionLookup(ctx: RequestContext, code: string): Promise<{
        order: null;
        claimed: boolean;
        claimedAt: null;
    } | {
        order: {
            id: import("@vendure/core").ID;
            code: string;
            state: import("@vendure/core").OrderState;
            totalWithTax: number;
            currencyCode: import("@vendure/core").CurrencyCode;
            totalQuantity: number;
        };
        claimed: boolean;
        claimedAt: any;
    }>;
    redemptionClaim(ctx: RequestContext, code: string): Promise<{
        order: {
            id: import("@vendure/core").ID;
            code: string;
            state: import("@vendure/core").OrderState;
            totalWithTax: number;
            currencyCode: import("@vendure/core").CurrencyCode;
            totalQuantity: number;
        };
        claimed: boolean;
        claimedAt: Date;
        message: string;
    }>;
}
