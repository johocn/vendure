"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BundleOrderInterceptor = void 0;
class BundleOrderInterceptor {
    willAdjustOrderLine(ctx, order, input) {
        if (input.orderLine.customFields.fromBundle) {
            return 'Cannot adjust bundle items';
        }
        return;
    }
    willRemoveItemFromOrder(ctx, order, orderLine) {
        if (orderLine.customFields.fromBundle) {
            return 'Cannot remove bundle items';
        }
        return;
    }
}
exports.BundleOrderInterceptor = BundleOrderInterceptor;
//# sourceMappingURL=bundle-order-interceptor.js.map