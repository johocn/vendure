import { RequestContext } from '@vendure/core';
import {
    DeliveryCreateRequest,
    DeliveryCreateResult,
    DeliveryCancelResult,
    DeliveryProvider,
    DeliveryQuote,
    DeliveryQuoteRequest,
    DeliveryStatusEvent,
} from './delivery-provider';

/** 模拟配送商：本地闭环验证用，接单/取货/送达由后台模拟接口触发 */
export class MockDeliveryProvider implements DeliveryProvider {
    readonly code = 'mock';
    readonly name = '模拟配送商';

    async quote(_ctx: RequestContext, req: DeliveryQuoteRequest): Promise<DeliveryQuote> {
        const distance = this.approxKm(req.pickup, req.dropoff);
        const fee = 500 + Math.round(distance * 150); // 起步 5 元 + 1.5 元/km
        return { fee, feeDetail: `起步5元+${distance.toFixed(1)}km*1.5元`, etaMinutes: 30, available: true };
    }

    async createDelivery(_ctx: RequestContext, req: DeliveryCreateRequest): Promise<DeliveryCreateResult> {
        return {
            deliveryOrderNo: `TDS${Date.now()}`,
            thirdPartyNo: `MOCK${Date.now()}`,
            status: 'pending',
            fee: (await this.quote(_ctx, req)).fee,
        };
    }

    async cancelDelivery(_ctx: RequestContext, _deliveryOrderNo: string, reason?: string): Promise<DeliveryCancelResult> {
        return { success: true, reason };
    }

    parseWebhook(payload: any): DeliveryStatusEvent {
        return {
            deliveryOrderNo: payload?.deliveryOrderNo,
            status: payload?.status,
            courierName: payload?.courierName,
            courierPhone: payload?.courierPhone,
            deliveredAt: payload?.deliveredAt ? new Date(payload.deliveredAt) : undefined,
            reason: payload?.reason,
        };
    }

    private approxKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
        const R = 6371;
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLng = ((b.lng - a.lng) * Math.PI) / 180;
        const s = Math.sin(dLat / 2) ** 2 +
            Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(s));
    }
}
