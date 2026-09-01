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
    paymentType: string | null;
    collected: boolean;
    pickupCode: string | null;
    pickupClaimable: boolean;
    pickupLocation: { name: string; address: string; businessHours: string } | null;
    lines: { productName: string; sku: string; quantity: number; linePriceWithTax: number }[];
    hasPhone: boolean;
}

export interface GuestLookupInputLike {
    phone?: string | null;
}

export type GuestAccessOutcome =
    | { allowed: true; reason?: undefined }
    | { allowed: false; reason: 'not_found' | 'window' | 'phone_mismatch' | 'not_guest' };

export function isGuestOrder(order: Order): boolean {
    return !order.customer?.user?.id;
}

export function guestLookupAllowed(
    order: Order | null,
    input: GuestLookupInputLike,
    windowAccess: boolean,
): GuestAccessOutcome {
    if (!order) return { allowed: false, reason: 'not_found' };
    if (input.phone) {
        if (!isGuestOrder(order)) return { allowed: false, reason: 'not_guest' };
        const cf = (order.customFields ?? {}) as any;
        if ((cf.contactPhone ?? '') !== input.phone) return { allowed: false, reason: 'phone_mismatch' };
        return { allowed: true };
    }
    if (windowAccess) return { allowed: true };
    return { allowed: false, reason: 'window' };
}

export function buildGuestOverview(
    order: Order,
    redemption: PickupRedemption | null,
    resolvedPickupLocation?: { name: string; address: string; businessHours: string } | null,
): GuestOrderOverview {
    const cf = (order.customFields ?? {}) as any;
    const isPickup = cf.deliveryType === 'pickup';
    const loc = cf.selectedPickupLocationId as any;
    // 关系自定义字段在 service 层可能只回传标量 id（未加载），此时用 resolver 预解析的取货点兜底
    const pickupLocation =
        loc && typeof loc === 'object' && (loc as any)?.name != null
            ? { name: loc.name ?? '', address: loc.address ?? '', businessHours: loc.businessHours ?? '' }
            : (resolvedPickupLocation ?? null);
    const shipped = (order.fulfillments ?? []).some(f => f.state === 'Shipped');
    const lines = (order.lines ?? []).map(l => ({
        productName: l?.productVariant?.product?.name ?? '',
        sku: l?.productVariant?.sku ?? '',
        quantity: l?.quantity ?? 0,
        linePriceWithTax: l?.linePriceWithTax ?? 0,
    }));
    return {
        orderCode: order.code,
        orderPlacedAt: order.orderPlacedAt ?? null,
        state: order.state,
        currencyCode: order.currencyCode,
        totalQuantity: order.totalQuantity,
        subTotal: order.subTotal,
        shippingWithTax: order.shippingWithTax,
        totalWithTax: order.totalWithTax,
        isPickup,
        pickupClaimed: isPickup && !!cf.pickupClaimed,
        paymentType: redemption?.paymentType ?? null,
        collected: !!redemption && (redemption.paymentType === 'online' || redemption.collected === true),
        pickupCode: redemption?.code ?? null,
        pickupClaimable: isPickup && !cf.pickupClaimed && shipped,
        pickupLocation,
        lines,
        hasPhone: !!cf.contactPhone,
    };
}