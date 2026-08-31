import { Order } from '@vendure/core';
import { PickupRedemption } from './pickup-redemption.entity';
export interface GuestOrderOverview {
    orderCode: string;
    orderPlacedAt: Date | null;
    state: string;
    currencyCode: string;
    totalQuantity: number;
    subTotal: number;
    shippingWithTax: number;
    totalWithTax: number;
    isPickup: boolean;
    pickupClaimed: boolean;
    pickupCode: string | null;
    pickupClaimable: boolean;
    pickupLocation: {
        name: string;
        address: string;
        businessHours: string;
    } | null;
    lines: {
        productName: string;
        sku: string;
        quantity: number;
        linePriceWithTax: number;
    }[];
    hasPhone: boolean;
}
export interface GuestLookupInputLike {
    phone?: string | null;
}
export type GuestAccessOutcome = {
    allowed: true;
    reason?: undefined;
} | {
    allowed: false;
    reason: 'not_found' | 'window' | 'phone_mismatch' | 'not_guest';
};
export declare function isGuestOrder(order: Order): boolean;
export declare function guestLookupAllowed(order: Order | null, input: GuestLookupInputLike, windowAccess: boolean): GuestAccessOutcome;
export declare function buildGuestOverview(order: Order, redemption: PickupRedemption | null, resolvedPickupLocation?: {
    name: string;
    address: string;
    businessHours: string;
} | null): GuestOrderOverview;
