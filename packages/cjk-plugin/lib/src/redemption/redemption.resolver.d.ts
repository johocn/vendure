import { ConfigService, EntityHydrator, OrderService, RequestContext } from '@vendure/core';
import { RedemptionCodeService } from './redemption-code.service';
import { RedeemScopeService } from '../tenant/redeem-scope.service';
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
    private redeemScopeService;
    constructor(redemptionCodeService: RedemptionCodeService, orderService: OrderService, entityHydrator: EntityHydrator, redeemScopeService: RedeemScopeService);
    /**
     * 受限核销员（持有 VerifyOrder）在配送档案范围外时，统一按「查不到」处理（不泄漏存在性）。
     * 不受限（店主/超管）恒为 true。
     */
    private inScope;
    myPendingRedemptions(ctx: RequestContext, options?: any): Promise<{
        items: import("./redemption-code.service").PendingRedemptionItem[];
        totalItems: number;
    }>;
    redemptionLookup(ctx: RequestContext, code: string): Promise<{
        order: null;
        claimed: boolean;
        claimedAt: null;
        status: string;
        expiresAt: null;
        version: number;
        reissueable: boolean;
        paymentType?: undefined;
        collected?: undefined;
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
        paymentType: any;
        collected: boolean;
    }>;
    redemptionClaim(ctx: RequestContext, code: string, collect?: boolean): Promise<{
        order: null;
        claimed: boolean;
        claimedAt: null;
        message: string;
        status: string;
        expiresAt: null;
        version: number;
        collectRequired: boolean;
        collected: boolean;
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
        message: string;
        status: import("./redemption-crypto").RedemptionStatus;
        expiresAt: string | null;
        version: number;
        collectRequired: boolean;
        collected: boolean;
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
        collectRequired: boolean;
        collected: boolean;
    }>;
}
