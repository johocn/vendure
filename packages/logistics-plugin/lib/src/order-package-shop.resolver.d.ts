import { RequestContext } from '@vendure/core';
import { OrderPackageService } from './order-package.service';
export declare class OrderPackageShopResolver {
    private orderPackageService;
    constructor(orderPackageService: OrderPackageService);
    myOrderPackages(ctx: RequestContext, orderId: string): Promise<{
        code: string;
        deliveryMode: string;
        status: string;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        shippingFee: number | null;
        lines: Array<{
            orderLineId: import("@vendure/core").ID;
            quantity: number;
            productName: string;
            sku: string;
        }>;
        trackingNo: string | null;
        carrierName: string | null;
        courierName: string | null;
        courierPhone: string | null;
        thirdPartyNo: string | null;
        etaMinutes: number | null;
    }[]>;
}
