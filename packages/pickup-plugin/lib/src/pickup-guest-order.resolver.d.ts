import { ConfigService, EntityHydrator, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { PickupService } from './pickup.service';
import { GuestOrderOverview } from './pickup-guest-order';
export declare class PickupGuestOrderResolver {
    private orderService;
    private configService;
    private entityHydrator;
    private connection;
    private service;
    constructor(orderService: OrderService, configService: ConfigService, entityHydrator: EntityHydrator, connection: TransactionalConnection, service: PickupService);
    guestOrderLookup(ctx: RequestContext, input: {
        orderCode: string;
        phone?: string;
    }): Promise<GuestOrderOverview>;
    guestSetOrderCustomFields(ctx: RequestContext, input: {
        orderCode: string;
        phone: string;
        name?: string;
    }): Promise<GuestOrderOverview>;
    private loadOrder;
    private findRedemption;
}
