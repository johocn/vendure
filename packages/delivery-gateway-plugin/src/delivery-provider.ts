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
    /** 平台侧门店编号覆盖（同一 Provider 多门店/多渠道时使用；不传则用 Provider 配置） */
    providerShopNo?: string;
}

export interface DeliveryCreateResult {
    deliveryOrderNo: string;   // 本地配送单号
    thirdPartyNo: string;      // 平台单号
    status: 'pending' | 'accepted';
    fee: number;
    /** 平台预估送达分钟数（可选；美团/达达不同接口返回字段不一） */
    etaMinutes?: number;
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
    /** 校验平台回调签名（未实现则不校验） */
    verifyCallback?(payload: unknown): boolean;
}

/** 网关 → 业务侧状态回传（业务侧用字符串 token 注册，避免循环依赖） */
export interface DeliveryStatusUpdate {
    deliveryOrderId: ID;
    orderId: ID;
    packageId?: string | null;
    providerCode: string;
    thirdPartyNo: string;
    status: DeliveryStatus;
    courierName?: string;
    courierPhone?: string;
    reason?: string;
}

export interface DeliveryStatusSink {
    onDeliveryStatus(ctx: RequestContext, update: DeliveryStatusUpdate): Promise<void>;
}
