export type DeliveryMode = 'self' | 'express' | 'pickup' | 'transfer';
export type DeliveryState =
    | 'Draft'
    | 'Shipped'
    | 'InTransit'
    | 'Delivered'
    | 'Assigned'
    | 'InProgress'
    | 'PickupPending'
    | 'PickupReady'
    | 'Completed'
    | 'TransferPending'
    | 'Arrived'
    | 'Exception'
    | 'Returned';

export const DELIVERY_TRANSITIONS: Record<DeliveryMode, Record<DeliveryState, DeliveryState[]>> = {
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

export function validateDeliveryTransition(
    mode: DeliveryMode,
    from: DeliveryState,
    to: DeliveryState,
): boolean {
    const table = DELIVERY_TRANSITIONS[mode];
    if (!table) {
        return false;
    }
    const allowed = table[from];
    if (!allowed) {
        return false;
    }
    return allowed.includes(to);
}
