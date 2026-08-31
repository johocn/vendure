import { ConfigService, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { PickupService } from './pickup.service';
import { GuestOrderOverview } from './pickup-guest-order';
export declare class PickupGuestOrderResolver {
    private orderService;
    private configService;
    private connection;
    private service;
    constructor(orderService: OrderService, configService: ConfigService, connection: TransactionalConnection, service: PickupService);
    guestOrderLookup(ctx: RequestContext, input: {
        orderCode: string;
        phone?: string;
    }): Promise<GuestOrderOverview>;
    guestSetOrderCustomFields(ctx: RequestContext, input: {
        orderCode: string;
        phone: string;
        name?: string;
    }): Promise<GuestOrderOverview>;
    /**
     * relation 类型自定义字段在 service 层未加载时只回传标量 id；
     * 从订单自定义字段配置取到 PickupLocation 实体类，按 id 解析为脱敏取货点信息。
     */
    private resolvePickupLocation;
    private loadOrder;
    private findRedemption;
}
