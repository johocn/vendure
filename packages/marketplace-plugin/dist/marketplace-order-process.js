"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketplaceOrderProcess = void 0;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
let connection;
let orderService;
let channelService;
let requestContextService;
exports.marketplaceOrderProcess = {
    init(injector) {
        connection = injector.get(core_1.TransactionalConnection);
        orderService = injector.get(core_1.OrderService);
        channelService = injector.get(core_1.ChannelService);
        requestContextService = injector.get(core_1.RequestContextService);
    },
    async onTransitionStart(fromState, toState, data) {
        const { ctx, order } = data;
        if (fromState === 'AddingItems' && toState === 'ArrangingPayment') {
            for (const line of data.order.lines) {
                if (!line.shippingLineId) {
                    return 'not all lines have shipping';
                }
            }
        }
        // Aggregate orders are allowed to transition to these states without validating
        // fulfillments, since aggregate orders do not have fulfillments, but will get
        // transitioned based on the status of the sellerOrders' fulfillments.
        if (order.type !== generated_types_1.OrderType.Aggregate) {
            if (toState === 'PartiallyShipped') {
                const orderWithFulfillments = await findOrderWithFulfillments(ctx, order.id);
                if (!(0, core_1.orderItemsArePartiallyShipped)(orderWithFulfillments)) {
                    return `message.cannot-transition-unless-some-order-items-shipped`;
                }
            }
            if (toState === 'Shipped') {
                const orderWithFulfillments = await findOrderWithFulfillments(ctx, order.id);
                if (!(0, core_1.orderItemsAreShipped)(orderWithFulfillments)) {
                    return `message.cannot-transition-unless-all-order-items-shipped`;
                }
            }
            if (toState === 'PartiallyDelivered') {
                const orderWithFulfillments = await findOrderWithFulfillments(ctx, order.id);
                if (!(0, core_1.orderItemsArePartiallyDelivered)(orderWithFulfillments)) {
                    return `message.cannot-transition-unless-some-order-items-delivered`;
                }
            }
            if (toState === 'Delivered') {
                const orderWithFulfillments = await findOrderWithFulfillments(ctx, order.id);
                if (!(0, core_1.orderItemsAreDelivered)(orderWithFulfillments)) {
                    return `message.cannot-transition-unless-all-order-items-delivered`;
                }
            }
        }
    },
    async onTransitionEnd(fromState, toState, data) {
        const { ctx, order } = data;
        if (order.type === generated_types_1.OrderType.Seller) {
            const aggregateOrder = await orderService.getAggregateOrder(ctx, order);
            if (aggregateOrder) {
                // Create a new RequestContext on the default Channel, since the current
                // RequestContext may be scoped to the Seller channel, and will not be able to
                // update the AggregateOrder.
                const defaultChannel = await channelService.getDefaultChannel();
                const defaultChannelCtx = await requestContextService.create({
                    apiType: 'admin',
                    channelOrToken: defaultChannel,
                    req: ctx.req,
                    languageCode: ctx.languageCode,
                    user: ctx.activeUserId ? new core_1.User({ id: ctx.activeUserId }) : undefined,
                });
                // This part is responsible for automatically updating the state of the aggregate Order
                // based on the fulfillment state of all the associated seller Orders.
                const otherSellerOrders = (await orderService.getSellerOrders(ctx, aggregateOrder)).filter(so => !(0, core_1.idsAreEqual)(so.id, order.id));
                const sellerOrderStates = [...otherSellerOrders.map(so => so.state), toState];
                if (sellerOrderStates.every(state => state === 'Shipped')) {
                    await orderService.transitionToState(defaultChannelCtx, aggregateOrder.id, 'Shipped');
                }
                else if (sellerOrderStates.every(state => state === 'Delivered')) {
                    await orderService.transitionToState(defaultChannelCtx, aggregateOrder.id, 'Delivered');
                }
                else if (sellerOrderStates.some(state => state === 'Delivered')) {
                    await orderService.transitionToState(defaultChannelCtx, aggregateOrder.id, 'PartiallyDelivered');
                }
                else if (sellerOrderStates.some(state => state === 'Shipped')) {
                    await orderService.transitionToState(defaultChannelCtx, aggregateOrder.id, 'PartiallyShipped');
                }
            }
        }
    },
};
async function findOrderWithFulfillments(ctx, id) {
    return await connection.getEntityOrThrow(ctx, core_1.Order, id, {
        relations: ['lines', 'fulfillments', 'fulfillments.lines', 'fulfillments.lines.fulfillment'],
    });
}
