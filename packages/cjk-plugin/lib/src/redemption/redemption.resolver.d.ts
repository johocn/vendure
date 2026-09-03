import { ConfigService, EntityHydrator, OrderService, RequestContext } from '@vendure/core';
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
    private entityHydrator;
    constructor(redemptionCodeService: RedemptionCodeService, orderService: OrderService, entityHydrator: EntityHydrator);
    redemptionLookup(ctx: RequestContext, code: string): Promise<{
        order: null;
        claimed: boolean;
        claimedAt: null;
        status: string;
        expiresAt: null;
        version: number;
        reissueable: boolean;
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
        status: import("./redemption-crypto").RedemptionStatus;
        expiresAt: any;
        version: number;
        reissueable: boolean;
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
    redemptionReissue(ctx: RequestContext, code: string): Promise<{
        order: {
            id: import("@vendure/core").ID;
            code: string;
            state: import("@vendure/core").OrderState;
            totalWithTax: number;
            currencyCode: import("@vendure/core").CurrencyCode;
            totalQuantity: number;
        };
        claimed: boolean;
        claimedAt: null;
        message: string;
        status: import("./redemption-crypto").RedemptionStatus;
        expiresAt: string;
        version: number;
    }>;
}
