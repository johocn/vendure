"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELIVERY_TRANSITIONS = void 0;
exports.validateDeliveryTransition = validateDeliveryTransition;
exports.DELIVERY_TRANSITIONS = {
    self: {
        Draft: ['Assigned', 'Shipped', 'InProgress', 'InTransit', 'Exception', 'Returned'],
        Assigned: ['InProgress', 'InTransit', 'Exception', 'Returned'],
        InProgress: ['Delivered', 'Exception', 'Returned'],
        InTransit: ['Delivered', 'Exception', 'Returned'],
        Shipped: ['InTransit', 'Exception', 'Returned'],
        Delivered: [],
        Exception: ['Returned', 'InTransit', 'InProgress'],
        Returned: [],
        TransferPending: [], PickupPending: [], PickupReady: [], Completed: [], Arrived: [],
    },
    express: {
        Draft: ['Shipped', 'Exception', 'Returned'],
        Shipped: ['InTransit', 'Exception', 'Returned'],
        InTransit: ['Delivered', 'Exception', 'Returned'],
        Delivered: [],
        Exception: ['Returned', 'InTransit'],
        Returned: [],
        Assigned: [], InProgress: [], TransferPending: [], PickupPending: [], PickupReady: [], Completed: [], Arrived: [],
    },
    pickup: {
        PickupPending: ['PickupReady', 'Exception', 'Returned'],
        PickupReady: ['Completed', 'Exception', 'Returned'],
        Completed: [],
        Exception: ['Returned', 'PickupReady'],
        Returned: [],
        Draft: [], Shipped: [], InTransit: [], Delivered: [], Assigned: [], InProgress: [],
        TransferPending: [], Arrived: [],
    },
    transfer: {
        TransferPending: ['InTransit', 'Exception'],
        InTransit: ['Arrived', 'Exception', 'Returned'],
        Arrived: [],
        Exception: ['Returned', 'InTransit', 'TransferPending'],
        Returned: [],
        Draft: [], Shipped: [], Delivered: [], Assigned: [], InProgress: [],
        PickupPending: [], PickupReady: [], Completed: [],
    },
};
function validateDeliveryTransition(mode, from, to) {
    const table = exports.DELIVERY_TRANSITIONS[mode];
    if (!table) {
        return false;
    }
    const allowed = table[from];
    if (!allowed) {
        return false;
    }
    return allowed.includes(to);
}
//# sourceMappingURL=delivery-state.js.map