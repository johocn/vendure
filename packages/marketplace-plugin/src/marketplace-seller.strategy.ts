import {
    ChannelService,
    EntityHydrator,
    ID,
    idsAreEqual,
    Injector,
    Order,
    OrderLine,
    OrderSellerStrategy,
    SplitOrderContents,
    TransactionalConnection,
} from '@vendure/core';
import { SALE_SOURCE_MARKETPLACE } from './constants';

export class MarketplaceSellerStrategy implements OrderSellerStrategy {
    private entityHydrator: EntityHydrator;
    private channelService: ChannelService;
    private connection: TransactionalConnection;

    init(injector: Injector) {
        this.entityHydrator = injector.get(EntityHydrator);
        this.channelService = injector.get(ChannelService);
        this.connection = injector.get(TransactionalConnection);
    }

    async setOrderLineSellerChannel(ctx: any, orderLine: OrderLine) {
        await this.entityHydrator.hydrate(ctx, orderLine.productVariant, { relations: ['channels'] });
        const defaultChannel = await this.channelService.getDefaultChannel();
        if (orderLine.productVariant.channels.length === 2) {
            const sellerChannel = orderLine.productVariant.channels.find(
                c => !idsAreEqual(c.id, defaultChannel.id),
            );
            if (sellerChannel) return sellerChannel;
        }
        return undefined;
    }

    async splitOrder(ctx: any, order: Order): Promise<SplitOrderContents[]> {
        const partialOrders = new Map<ID, SplitOrderContents>();
        for (const line of order.lines) {
            const sellerChannelId = (line as any).sellerChannelId;
            if (sellerChannelId) {
                let partial = partialOrders.get(sellerChannelId);
                if (!partial) {
                    partial = { channelId: sellerChannelId, shippingLines: [], lines: [], state: 'ArrangingPayment' };
                    partialOrders.set(sellerChannelId, partial);
                }
                partial.lines.push(line);
            }
        }
        for (const partial of partialOrders.values()) {
            const ids = new Set(partial.lines.map(l => (l as any).shippingLineId));
            partial.shippingLines = order.shippingLines.filter(sl => ids.has(sl.id));
        }
        return [...partialOrders.values()];
    }

    async afterSellerOrdersCreated(ctx: any, aggregateOrder: Order, sellerOrders: Order[]) {
        for (const sellerOrder of sellerOrders) {
            sellerOrder.customFields.saleSource = SALE_SOURCE_MARKETPLACE;
            await this.connection.getRepository(ctx, sellerOrder.constructor).save(sellerOrder);
        }
    }
}