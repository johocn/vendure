"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGuestOrder = isGuestOrder;
exports.guestLookupAllowed = guestLookupAllowed;
exports.buildGuestOverview = buildGuestOverview;
function isGuestOrder(order) {
    var _a, _b;
    return !((_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id);
}
function guestLookupAllowed(order, input, windowAccess) {
    var _a, _b;
    if (!order)
        return { allowed: false, reason: 'not_found' };
    if (input.phone) {
        if (!isGuestOrder(order))
            return { allowed: false, reason: 'not_guest' };
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        if (((_b = cf.contactPhone) !== null && _b !== void 0 ? _b : '') !== input.phone)
            return { allowed: false, reason: 'phone_mismatch' };
        return { allowed: true };
    }
    if (windowAccess)
        return { allowed: true };
    return { allowed: false, reason: 'window' };
}
function buildGuestOverview(order, redemption) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
    const isPickup = cf.deliveryType === 'pickup';
    const loc = cf.selectedPickupLocationId;
    const pickupLocation = loc && typeof loc === 'object'
        ? { name: (_b = loc.name) !== null && _b !== void 0 ? _b : '', address: (_c = loc.address) !== null && _c !== void 0 ? _c : '', businessHours: (_d = loc.businessHours) !== null && _d !== void 0 ? _d : '' }
        : null;
    const shipped = ((_e = order.fulfillments) !== null && _e !== void 0 ? _e : []).some(f => f.state === 'Shipped');
    const lines = ((_f = order.lines) !== null && _f !== void 0 ? _f : []).map(l => {
        var _a, _b, _c, _d, _e, _f, _g;
        return ({
            productName: (_c = (_b = (_a = l === null || l === void 0 ? void 0 : l.productVariant) === null || _a === void 0 ? void 0 : _a.product) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : '',
            sku: (_e = (_d = l === null || l === void 0 ? void 0 : l.productVariant) === null || _d === void 0 ? void 0 : _d.sku) !== null && _e !== void 0 ? _e : '',
            quantity: (_f = l === null || l === void 0 ? void 0 : l.quantity) !== null && _f !== void 0 ? _f : 0,
            linePriceWithTax: (_g = l === null || l === void 0 ? void 0 : l.linePriceWithTax) !== null && _g !== void 0 ? _g : 0,
        });
    });
    return {
        orderCode: order.code,
        orderPlacedAt: (_g = order.orderPlacedAt) !== null && _g !== void 0 ? _g : null,
        state: order.state,
        currencyCode: order.currencyCode,
        totalQuantity: order.totalQuantity,
        subTotal: order.subTotal,
        shippingWithTax: order.shippingWithTax,
        totalWithTax: order.totalWithTax,
        isPickup,
        pickupClaimed: isPickup && !!cf.pickupClaimed,
        pickupCode: (_h = redemption === null || redemption === void 0 ? void 0 : redemption.code) !== null && _h !== void 0 ? _h : null,
        pickupClaimable: isPickup && !cf.pickupClaimed && shipped,
        pickupLocation,
        lines,
        hasPhone: !!cf.contactPhone,
    };
}
//# sourceMappingURL=pickup-guest-order.js.map