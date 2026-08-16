"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceSellerStrategy = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
class MarketplaceSellerStrategy {
    init(injector) {
        this.entityHydrator = injector.get(core_1.EntityHydrator);
        this.channelService = injector.get(core_1.ChannelService);
        this.connection = injector.get(core_1.TransactionalConnection);
    }
    async setOrderLineSellerChannel(ctx, orderLine) {
        await this.entityHydrator.hydrate(ctx, orderLine.productVariant, { relations: ['channels'] });
        const defaultChannel = await this.channelService.getDefaultChannel();
        if (orderLine.productVariant.channels.length === 2) {
            const sellerChannel = orderLine.productVariant.channels.find(c => !(0, core_1.idsAreEqual)(c.id, defaultChannel.id));
            if (sellerChannel)
                return sellerChannel;
        }
        return undefined;
    }
    async splitOrder(ctx, order) {
        const partialOrders = new Map();
        for (const line of order.lines) {
            const sellerChannelId = line.sellerChannelId;
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
            const ids = new Set(partial.lines.map(l => l.shippingLineId));
            partial.shippingLines = order.shippingLines.filter(sl => ids.has(sl.id));
        }
        return [...partialOrders.values()];
    }
    async afterSellerOrdersCreated(ctx, aggregateOrder, sellerOrders) {
        for (const sellerOrder of sellerOrders) {
            sellerOrder.customFields.saleSource = constants_1.SALE_SOURCE_MARKETPLACE;
            await this.connection.getRepository(ctx, sellerOrder.constructor).save(sellerOrder);
        }
    }
}
exports.MarketplaceSellerStrategy = MarketplaceSellerStrategy;
