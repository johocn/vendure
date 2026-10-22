import { Logger, RequestContext } from '@vendure/core';
import {
    DeliveryCancelResult,
    DeliveryCreateRequest,
    DeliveryCreateResult,
    DeliveryProvider,
    DeliveryQuote,
    DeliveryQuoteRequest,
    DeliveryStatus,
    DeliveryStatusEvent,
} from './delivery-provider';
import { MeituanHttpAdapter } from './meituan-http.adapter';
import { MeituanSignMode, verifyMeituanCallback } from './meituan-signature';
import { loggerCtx } from './constants';

export interface MeituanProviderConfig {
    appKey: string;
    appSecret: string;
    signMode: MeituanSignMode;
    shopId: string;
    baseUrl?: string;
    /** 回调地址（open 模式验签需要与请求同一 URL 口径） */
    callbackUrl?: string;
    /** 缺省配送员电话（美团要求必填时使用） */
    defaultCourierPhone?: string;
}

/** 美团配送状态码 → 统一状态（0/10 待接单、20 已接单、30/40 取货/配送中、50 完成、99 取消） */
export const MEITUAN_STATUS_MAP: Record<number, DeliveryStatus> = {
    0: 'pending',
    10: 'pending',
    20: 'accepted',
    30: 'pickup',
    40: 'pickup',
    50: 'delivered',
    99: 'cancelled',
};

export function mapMeituanStatus(raw: unknown): DeliveryStatus {
    const n = Number(raw);
    return MEITUAN_STATUS_MAP[n] ?? 'exception';
}

export class MeituanDeliveryProvider implements DeliveryProvider {
    readonly code = 'meituan';
    readonly name = '美团配送';
    private http: MeituanHttpAdapter;

    constructor(private config: MeituanProviderConfig) {
        this.http = new MeituanHttpAdapter(config);
    }

    async quote(_ctx: RequestContext, req: DeliveryQuoteRequest): Promise<DeliveryQuote> {
        // 美团询价接口存在版本差异；统一走 create 前的预校验接口，失败时给不可用而非抛错
        try {
            const data: any = await this.http.post('/api/order/queryPrice', {
                shop_id: this.config.shopId,
                receiver_address: req.dropoff.address ?? req.dropoff.name,
                receiver_latitude: req.dropoff.lat,
                receiver_longitude: req.dropoff.lng,
                goods_weight: req.weight ?? 1,
            });
            return {
                fee: Number(data?.price ?? data?.delivery_fee ?? 0),
                feeDetail: JSON.stringify(data ?? {}),
                etaMinutes: Number(data?.estimate_time ?? 30),
                available: true,
            };
        } catch {
            return { fee: 0, feeDetail: '', etaMinutes: 0, available: false };
        }
    }

    async createDelivery(_ctx: RequestContext, req: DeliveryCreateRequest): Promise<DeliveryCreateResult> {
        const data: any = await this.http.post('/api/order/create', {
            shop_id: req.providerShopNo || this.config.shopId,
            delivery_id: `WM${req.orderId}-${Date.now()}`,
            receiver_name: req.dropoff.name,
            receiver_phone: req.dropoff.phone ?? '',
            receiver_address: req.dropoff.address ?? req.dropoff.name,
            receiver_latitude: req.dropoff.lat,
            receiver_longitude: req.dropoff.lng,
            sender_name: req.pickup.name,
            sender_phone: req.pickup.phone ?? this.config.defaultCourierPhone ?? '',
            sender_address: req.pickup.address ?? req.pickup.name,
            sender_latitude: req.pickup.lat,
            sender_longitude: req.pickup.lng,
            goods_name: req.items.map(i => i.name).join('、').slice(0, 50) || '外卖餐品',
            goods_count: req.items.reduce((s, i) => s + i.quantity, 0),
            note: req.remark ?? '',
            callback_url: req.callbackUrl ?? this.config.callbackUrl ?? '',
        });
        const thirdPartyNo = String(data?.order_id ?? data?.delivery_no ?? '');
        if (!thirdPartyNo) {
            throw new Error('美团下单返回缺 order_id');
        }
        return {
            deliveryOrderNo: thirdPartyNo,
            thirdPartyNo,
            status: 'pending',
            fee: Number(data?.delivery_fee ?? data?.price ?? 0),
            etaMinutes: Number(data?.estimate_time ?? 30),
        };
    }

    async cancelDelivery(_ctx: RequestContext, deliveryOrderNo: string, reason?: string): Promise<DeliveryCancelResult> {
        try {
            await this.http.post('/api/order/cancel', {
                shop_id: this.config.shopId,
                order_id: deliveryOrderNo,
                cancel_reason: reason ?? '商家取消',
            });
            return { success: true };
        } catch (e: any) {
            return { success: false, reason: e?.message ?? String(e) };
        }
    }

    /** 美团回调字段兼容：order_id / status / courier_name / courier_phone / cancel_reason */
    parseWebhook(payload: unknown): DeliveryStatusEvent {
        const raw = (payload ?? {}) as Record<string, unknown>;
        let body = raw;
        if (typeof raw.body === 'string') {
            try {
                body = JSON.parse(raw.body) as Record<string, unknown>;
            } catch {
                body = raw;
            }
        } else if (raw.body && typeof raw.body === 'object') {
            body = raw.body as Record<string, unknown>;
        }
        const deliveryOrderNo = String(body.order_id ?? body.delivery_no ?? '');
        if (!deliveryOrderNo) {
            throw new Error('美团回调报文缺 order_id');
        }
        return {
            deliveryOrderNo,
            status: mapMeituanStatus(body.status),
            courierName: body.courier_name ? String(body.courier_name) : undefined,
            courierPhone: body.courier_phone ? String(body.courier_phone) : undefined,
            reason: body.cancel_reason ? String(body.cancel_reason) : undefined,
        };
    }

    verifyCallback(payload: unknown): boolean {
        // open 模式签名含请求 URL，未配置 callbackUrl 时无法重算：放行并告警，避免整条链路静默丢回调
        if (this.config.signMode === 'open' && !this.config.callbackUrl) {
            Logger.warn('美团 open 模式未配置 callbackUrl，跳过回调验签', loggerCtx);
            return true;
        }
        const raw = (payload ?? {}) as Record<string, unknown>;
        return verifyMeituanCallback(raw, this.config.appSecret, this.config.signMode, this.config.callbackUrl ?? '');
    }
}
