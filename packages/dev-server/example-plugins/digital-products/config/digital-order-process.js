"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.digitalOrderProcess = void 0;
const core_1 = require("@vendure/core");
const digital_fulfillment_handler_1 = require("./digital-fulfillment-handler");
let orderService;
/**
 * @description
 * This OrderProcess ensures that when an Order transitions from ArrangingPayment to
 * PaymentAuthorized or PaymentSettled, then any digital products are automatically
 * fulfilled.
 */
exports.digitalOrderProcess = {
    init(injector) {
        orderService = injector.get(core_1.OrderService);
    },
    async onTransitionEnd(fromState, toState, data) {
        if (fromState === 'ArrangingPayment' &&
            (toState === 'PaymentAuthorized' || toState === 'PaymentSettled')) {
            const digitalOrderLines = data.order.lines.filter(l => l.productVariant.customFields.isDigital);
            if (digitalOrderLines.length) {
                await orderService.createFulfillment(data.ctx, {
                    lines: digitalOrderLines.map(l => ({ orderLineId: l.id, quantity: l.quantity })),
                    handler: { code: digital_fulfillment_handler_1.digitalFulfillmentHandler.code, arguments: [] },
                });
            }
        }
    },
};
//# sourceMappingURL=digital-order-process.js.map