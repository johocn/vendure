import { ChannelService, Injector, OrderService, PaymentService, RequestContext, TransactionalConnection } from '@vendure/core';
export declare class GroupBuyJob {
    private connection;
    private orderService;
    private paymentService;
    private channelService;
    constructor(connection: TransactionalConnection, orderService: OrderService, paymentService: PaymentService, channelService: ChannelService);
    private stockPrewarmService;
    initStock(injector: Injector): void;
    runCheck(ctx: RequestContext): Promise<void>;
    private refundOrderPayments;
}
