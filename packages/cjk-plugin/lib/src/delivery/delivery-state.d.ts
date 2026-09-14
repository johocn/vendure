export type DeliveryMode = 'self' | 'express' | 'pickup' | 'transfer';
export type DeliveryState = 'Draft' | 'Shipped' | 'InTransit' | 'Delivered' | 'Assigned' | 'InProgress' | 'PickupPending' | 'PickupReady' | 'Completed' | 'TransferPending' | 'Arrived' | 'Exception' | 'Returned';
export declare const DELIVERY_TRANSITIONS: Record<DeliveryMode, Record<DeliveryState, DeliveryState[]>>;
export declare function validateDeliveryTransition(mode: DeliveryMode, from: DeliveryState, to: DeliveryState): boolean;
