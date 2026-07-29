"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultivendorShippingLineAssignmentStrategy = void 0;
const core_1 = require("@vendure/core");
class MultivendorShippingLineAssignmentStrategy {
    init(injector) {
        this.entityHydrator = injector.get(core_1.EntityHydrator);
        this.channelService = injector.get(core_1.ChannelService);
    }
    async assignShippingLineToOrderLines(ctx, shippingLine, order) {
        // First we need to ensure the required relations are available
        // to work with.
        const defaultChannel = await this.channelService.getDefaultChannel();
        await this.entityHydrator.hydrate(ctx, shippingLine, { relations: ['shippingMethod.channels'] });
        const { channels } = shippingLine.shippingMethod;
        // We assume that, if a ShippingMethod is assigned to exactly 2 Channels,
        // then one is the default Channel and the other is the seller's Channel.
        if (channels.length === 2) {
            const sellerChannel = channels.find(c => !(0, core_1.idsAreEqual)(c.id, defaultChannel.id));
            if (sellerChannel) {
                // Once we have established the seller's Channel, we can filter the OrderLines
                // that belong to that Channel. The `sellerChannelId` was previously established
                // in the `OrderSellerStrategy.setOrderLineSellerChannel()` method.
                return order.lines.filter(line => (0, core_1.idsAreEqual)(line.sellerChannelId, sellerChannel.id));
            }
        }
        return order.lines;
    }
}
exports.MultivendorShippingLineAssignmentStrategy = MultivendorShippingLineAssignmentStrategy;
//# sourceMappingURL=mv-shipping-line-assignment-strategy.js.map