import { RequestContext } from '@vendure/core';
import { DeliveryCancelResult, DeliveryCreateRequest, DeliveryCreateResult, DeliveryProvider, DeliveryQuote, DeliveryQuoteRequest, DeliveryStatus, DeliveryStatusEvent } from './delivery-provider';
import { MeituanSignMode } from './meituan-signature';
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
export declare const MEITUAN_STATUS_MAP: Record<number, DeliveryStatus>;
export declare function mapMeituanStatus(raw: unknown): DeliveryStatus;
export declare class MeituanDeliveryProvider implements DeliveryProvider {
    private config;
    readonly code = "meituan";
    readonly name = "\u7F8E\u56E2\u914D\u9001";
    private http;
    constructor(config: MeituanProviderConfig);
    quote(_ctx: RequestContext, req: DeliveryQuoteRequest): Promise<DeliveryQuote>;
    createDelivery(_ctx: RequestContext, req: DeliveryCreateRequest): Promise<DeliveryCreateResult>;
    cancelDelivery(_ctx: RequestContext, deliveryOrderNo: string, reason?: string): Promise<DeliveryCancelResult>;
    /** 主动查询运单状态（轮询对账）：美团订单详情接口，状态复用回调映射 */
    queryStatus(_ctx: RequestContext, deliveryOrderNo: string): Promise<DeliveryStatusEvent | null>;
    /** 美团回调字段兼容：order_id / status / courier_name / courier_phone / cancel_reason */
    parseWebhook(payload: unknown): DeliveryStatusEvent;
    verifyCallback(payload: unknown): boolean;
}
