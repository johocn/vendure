import { Injector, Order, OrderLine, OrderSellerStrategy, SplitOrderContents } from '@vendure/core';
export declare class MarketplaceSellerStrategy implements OrderSellerStrategy {
    private entityHydrator;
    private channelService;
    private connection;
    init(injector: Injector): void;
    setOrderLineSellerChannel(ctx: any, orderLine: OrderLine): Promise<import("@vendure/core").Channel | undefined>;
    splitOrder(ctx: any, order: Order): Promise<SplitOrderContents[]>;
    afterSellerOrdersCreated(ctx: any, aggregateOrder: Order, sellerOrders: Order[]): Promise<void>;
}
