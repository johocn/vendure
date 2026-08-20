import { RequestContext, Logger } from '@vendure/core';
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
import { buildSignedParams, verifyCallbackSignature } from './dada-signature';
import { DadaHttpAdapter, FetchDadaHttpAdapter } from './dada-http.adapter';
import { loggerCtx } from './constants';

export interface DadaProviderConfig {
    appKey: string;
    appSecret: string;
    shopNo: string;
    sourceId?: string;
    environment: 'sandbox' | 'production';
    callbackUrl: string;
}

/** 达达订单状态码 → 本地 DeliveryStatus（单一事实源，spec 复用） */
export const DADA_STATUS_MAP: Record<number, DeliveryStatus> = {
    1: 'pending', // 待接单
    2: 'accepted', // 已接单
    3: 'pickup', // 取货中
    4: 'pickup', // 配送中
    5: 'delivered', // 已完成
    7: 'cancelled', // 已过期
    10: 'cancelled', // 已取消
    1000: 'exception', // 异常/创建失败
};

const ENV_BASE_URL: Record<DadaProviderConfig['environment'], string> = {
    sandbox: 'https://newopen.qa.imdada.cn',
    production: 'https://newopen.imdada.cn',
};

/** 达达同城配送 Provider：契约层按官方文档固化，无凭据也可验证入站全链路 */
export class DadaDeliveryProvider implements DeliveryProvider {
    readonly code = 'dada';
    readonly name = '达达同城配送';
    private readonly http: DadaHttpAdapter;

    constructor(private readonly config: DadaProviderConfig, http?: DadaHttpAdapter) {
        this.http = http ?? new FetchDadaHttpAdapter(ENV_BASE_URL[config.environment]);
    }

    /** 校验达达回调报文签名（用本 Provider 的 appSecret） */
    verifyCallback(payload: unknown): boolean {
        return verifyCallbackSignature(payload, this.config.appSecret);
    }

    async quote(_ctx: RequestContext, req: DeliveryQuoteRequest): Promise<DeliveryQuote> {
        try {
            const body = {
                shop_no: this.config.shopNo,
                origin_id: `Q${Date.now()}`,
                cargo_type: 1,
                cargo_weight: req.weight ?? this.estimateWeight(req.items),
                receiver_lat: req.dropoff.lat,
                receiver_lng: req.dropoff.lng,
            };
            const res = await this.request('/api/order/queryDeliverFee', body);
            const result = (res?.result ?? {}) as Record<string, unknown>;
            const fee = Number(result.fee ?? 0);
            return {
                fee,
                feeDetail: `达达计价 distance=${String(result.distance ?? 0)}m`,
                etaMinutes: Math.round(Number(result.delivery_latency ?? 0) / 60),
                available: fee > 0,
            };
        } catch (e: any) {
            Logger.warn(`达达计价失败: ${e?.message ?? e}`, loggerCtx);
            return { fee: 0, feeDetail: '达达计价失败', etaMinutes: 0, available: false };
        }
    }

    async createDelivery(_ctx: RequestContext, req: DeliveryCreateRequest): Promise<DeliveryCreateResult> {
        const originId = `TDD${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const body = {
            shop_no: this.config.shopNo,
            origin_id: originId,
            cargo_price: 0, // 骨架阶段占位：按需结合订单金额
            is_prepay: 0,
            receiver_name: req.dropoff.name,
            receiver_address: req.dropoff.address ?? req.dropoff.name,
            receiver_lat: req.dropoff.lat,
            receiver_lng: req.dropoff.lng,
            receiver_phone: req.dropoff.phone ?? '',
            cargo_weight: req.weight ?? this.estimateWeight(req.items),
            callback: this.config.callbackUrl,
            cargo_num: req.items.reduce((s, i) => s + i.quantity, 0),
            info: req.remark ?? '',
        };
        const res = await this.request('/api/order/addOrder', body);
        if (res?.status !== 'success') {
            throw new Error(`达达下单失败: ${JSON.stringify(res?.result ?? res)}`);
        }
        const result = (res.result ?? {}) as Record<string, unknown>;
        const deliveryNo = String(result.deliveryNo ?? '');
        if (!deliveryNo) {
            throw new Error('达达下单返回缺 deliveryNo');
        }
        return {
            deliveryOrderNo: originId,
            thirdPartyNo: deliveryNo,
            status: 'pending',
            fee: Number(result.fee ?? 0),
        };
    }

    async cancelDelivery(_ctx: RequestContext, deliveryOrderNo: string, reason?: string): Promise<DeliveryCancelResult> {
        try {
            const body = {
                order_id: deliveryOrderNo, // 达达单号（= DeliveryOrder.thirdPartyNo）
                cancel_reason_id: 1,
                cancel_reason: reason ?? '',
            };
            const res = await this.request('/api/order/formalCancel', body);
            if (res?.status !== 'success') {
                return { success: false, reason: JSON.stringify(res?.result ?? res) };
            }
            return { success: true, reason };
        } catch (e: any) {
            Logger.warn(`达达取消失败 ${deliveryOrderNo}: ${e?.message ?? e}`, loggerCtx);
            return { success: false, reason: e?.message ?? String(e) };
        }
    }

    parseWebhook(payload: any): DeliveryStatusEvent {
        // 达达回调业务字段位于 body(JSON 字符串)；兼容平铺 top-level
        let business = payload;
        if (payload && typeof payload.body === 'string') {
            try {
                business = JSON.parse(payload.body);
            } catch {
                business = payload;
            }
        }
        const statusCode = Number(business?.order_status ?? -1);
        const status = DADA_STATUS_MAP[statusCode];
        if (!status) {
            throw new Error(`未识别的达达状态码: ${statusCode}`);
        }
        // 优先 order_id（本地第三方单号=code）；缺失时兜底 client_id（达达单号=thirdPartyNo）
        const deliveryOrderNo = String(business?.order_id ?? business?.client_id ?? '');
        if (!deliveryOrderNo) {
            throw new Error('达达回调报文缺 order_id/client_id');
        }
        return {
            deliveryOrderNo,
            status,
            courierName: business?.transporter_name,
            courierPhone: business?.transporter_phone,
            deliveredAt: status === 'delivered' ? new Date() : undefined,
            reason: business?.cancel_reason ?? business?.reason ?? business?.msg,
        };
    }

    private async request(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
        const params = buildSignedParams(this.config.appKey, this.config.appSecret, body, {
            sourceId: this.config.sourceId,
        });
        return this.http.post(path, params as unknown as Record<string, unknown>);
    }

    private estimateWeight(items: { name: string; quantity: number }[]): number {
        const kg = items.reduce((s, i) => s + i.quantity, 0) * 0.5;
        return Math.max(1, Math.ceil(kg));
    }
}