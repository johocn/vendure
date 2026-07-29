"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalShippingLineAssignmentStrategy = void 0;
/**
 * @description
 * This ShippingLineAssignmentStrategy ensures that digital products are assigned to a
 * ShippingLine which has the `isDigital` flag set to true.
 */
class DigitalShippingLineAssignmentStrategy {
    assignShippingLineToOrderLines(ctx, shippingLine, order) {
        if (shippingLine.shippingMethod.customFields.isDigital) {
            return order.lines.filter(l => l.productVariant.customFields.isDigital);
        }
        else {
            return order.lines.filter(l => !l.productVariant.customFields.isDigital);
        }
    }
}
exports.DigitalShippingLineAssignmentStrategy = DigitalShippingLineAssignmentStrategy;
//# sourceMappingURL=digital-shipping-line-assignment-strategy.js.map