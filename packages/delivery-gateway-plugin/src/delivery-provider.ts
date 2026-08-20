import { ID, RequestContext } from '@vendure/core';

export type DeliveryStatus = 'pending' | 'accepted' | 'pickup' | 'delivered' | 'cancelled' | 'exception';

export interface GeoPoint { name: string; address?: string; lat: number; lng: number; phone?: string; }
export interface DeliveryItem { name: string; quantity: number; }

export interface DeliveryQuoteRequest {
    pickup: GeoPoint;
    dropoff: GeoPoint;
    items: DeliveryItem[];
    weight?: number;
    deliveryType: 'instant' | 'scheduled';
    expectedPickupAt?: Date;
}

export interface DeliveryQuote {
    fee: number;           // 分
    feeDetail: string;
    etaMinutes: number;
    available: boolean;
}

export interface DeliveryCreateRequest extends DeliveryQuoteRequest {
    orderId: ID;
    packageId: string;
    remark?: string;
    callbackUrl?: string;
}

export interface DeliveryCreateResult {
    deliveryOrderNo: string;   // 本地配送单号
    thirdPartyNo: string;      // 平台单号
    status: 'pending' | 'accepted';
    fee: number;
}

export interface DeliveryCancelResult { success: boolean; reason?: string; }

export interface DeliveryStatusEvent {
    deliveryOrderNo: string;
    status: DeliveryStatus;
    courierName?: string;
    courierPhone?: string;
    deliveredAt?: Date;
    reason?: string;
}

export interface DeliveryProvider {
    readonly code: string;
    readonly name: string;
    quote(ctx: RequestContext, req: DeliveryQuoteRequest): Promise<DeliveryQuote>;
    createDelivery(ctx: RequestContext, req: DeliveryCreateRequest): Promise<DeliveryCreateResult>;
    cancelDelivery(ctx: RequestContext, deliveryOrderNo: string, reason?: string): Promise<DeliveryCancelResult>;
    parseWebhook(payload: unknown): DeliveryStatusEvent;
}
