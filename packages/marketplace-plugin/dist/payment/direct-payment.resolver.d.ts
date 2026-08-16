import { CustomerService, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
export declare class DirectPaymentResolver {
    private orderService;
    private customerService;
    private connection;
    constructor(orderService: OrderService, customerService: CustomerService, connection: TransactionalConnection);
    payMarketplaceSellerOrder(ctx: RequestContext, args: {
        orderId: string;
        method: string;
        metadata?: any;
    }): Promise<any>;
    myMarketplaceSellerOrders(ctx: RequestContext): Promise<any[]>;
}
