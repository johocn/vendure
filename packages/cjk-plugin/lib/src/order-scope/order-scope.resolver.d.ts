import { RequestContext } from '@vendure/core';
import { OrderScopeService, ScopedOrderFilter } from './order-scope.service';
export declare class OrderScopeAdminResolver {
    private orderScopeService;
    constructor(orderScopeService: OrderScopeService);
    scopedOrders(ctx: RequestContext, filter?: ScopedOrderFilter, take?: number, skip?: number): Promise<import("./order-scope.service").ScopedOrderList>;
    scopedOrderCounts(ctx: RequestContext, filters?: ScopedOrderFilter[]): Promise<number[]>;
    newOrderSignal(ctx: RequestContext, since: string): Promise<import("./order-scope.service").NewOrderSignal>;
}
