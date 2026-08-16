import { CustomerService, OrderService, RequestContext } from '@vendure/core';
export declare class DirectPaymentResolver {
    private orderService;
    private customerService;
    constructor(orderService: OrderService, customerService: CustomerService);
    payMarketplaceSellerOrder(ctx: RequestContext, args: {
        orderId: string;
        method: string;
        metadata?: any;
    }): Promise<any>;
}
