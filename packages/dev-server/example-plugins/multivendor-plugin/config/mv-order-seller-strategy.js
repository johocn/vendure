"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultivendorSellerStrategy = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
class MultivendorSellerStrategy {
    init(injector) {
        this.entityHydrator = injector.get(core_1.EntityHydrator);
        this.channelService = injector.get(core_1.ChannelService);
        this.paymentService = injector.get(core_1.PaymentService);
        this.paymentMethodService = injector.get(core_1.PaymentMethodService);
        this.connection = injector.get(core_1.TransactionalConnection);
        this.orderService = injector.get(core_1.OrderService);
        this.options = injector.get(constants_1.MULTIVENDOR_PLUGIN_OPTIONS);
    }
    async setOrderLineSellerChannel(ctx, orderLine) {
        await this.entityHydrator.hydrate(ctx, orderLine.productVariant, { relations: ['channels'] });
        const defaultChannel = await this.channelService.getDefaultChannel();
        // If a ProductVariant is assigned to exactly 2 Channels, then one is the default Channel
        // and the other is the seller's Channel.
        if (orderLine.productVariant.channels.length === 2) {
            const sellerChannel = orderLine.productVariant.channels.find(c => !(0, core_1.idsAreEqual)(c.id, defaultChannel.id));
            if (sellerChannel) {
                return sellerChannel;
            }
        }
    }
    async splitOrder(ctx, order) {
        const partialOrders = new Map();
        for (const line of order.lines) {
            const sellerChannelId = line.sellerChannelId;
            if (sellerChannelId) {
                let partialOrder = partialOrders.get(sellerChannelId);
                if (!partialOrder) {
                    partialOrder = {
                        channelId: sellerChannelId,
                        shippingLines: [],
                        lines: [],
                        state: 'ArrangingPayment',
                    };
                    partialOrders.set(sellerChannelId, partialOrder);
                }
                partialOrder.lines.push(line);
            }
        }
        for (const partialOrder of partialOrders.values()) {
            const shippingLineIds = new Set(partialOrder.lines.map(l => l.shippingLineId));
            partialOrder.shippingLines = order.shippingLines.filter(shippingLine => shippingLineIds.has(shippingLine.id));
        }
        return [...partialOrders.values()];
    }
    async afterSellerOrdersCreated(ctx, aggregateOrder, sellerOrders) {
        var _a;
        const paymentMethod = await this.connection.rawConnection.getRepository(core_1.PaymentMethod).findOne({
            where: {
                code: constants_1.CONNECTED_PAYMENT_METHOD_CODE,
            },
        });
        if (!paymentMethod) {
            return;
        }
        const defaultChannel = await this.channelService.getDefaultChannel();
        for (const sellerOrder of sellerOrders) {
            const sellerChannel = sellerOrder.channels.find(c => !(0, core_1.idsAreEqual)(c.id, defaultChannel.id));
            if (!sellerChannel) {
                throw new core_1.InternalServerError(`Could not determine Seller Channel for Order ${sellerOrder.code}`);
            }
            sellerOrder.surcharges = [await this.createPlatformFeeSurcharge(ctx, sellerOrder)];
            await this.orderService.applyPriceAdjustments(ctx, sellerOrder);
            await this.entityHydrator.hydrate(ctx, sellerChannel, { relations: ['seller'] });
            const result = await this.orderService.addPaymentToOrder(ctx, sellerOrder.id, {
                method: paymentMethod.code,
                metadata: {
                    transfer_group: aggregateOrder.code,
                    connectedAccountId: (_a = sellerChannel.seller) === null || _a === void 0 ? void 0 : _a.customFields.connectedAccountId,
                },
            });
            if ((0, core_1.isGraphQlErrorResult)(result)) {
                throw new core_1.InternalServerError(result.message);
            }
        }
    }
    async createPlatformFeeSurcharge(ctx, sellerOrder) {
        const platformFee = Math.round(sellerOrder.totalWithTax * -(this.options.platformFeePercent / 100));
        return this.connection.getRepository(ctx, core_1.Surcharge).save(new core_1.Surcharge({
            taxLines: [],
            sku: this.options.platformFeeSKU,
            description: 'Platform fee',
            listPrice: platformFee,
            listPriceIncludesTax: true,
            order: sellerOrder,
        }));
    }
}
exports.MultivendorSellerStrategy = MultivendorSellerStrategy;
//# sourceMappingURL=mv-order-seller-strategy.js.map