import { RequestContext } from '@vendure/core';
import { DeliveryCancelResult, DeliveryCreateRequest, DeliveryCreateResult, DeliveryProvider, DeliveryQuote, DeliveryQuoteRequest, DeliveryStatus, DeliveryStatusEvent } from './delivery-provider';
import { DadaHttpAdapter } from './dada-http.adapter';
export interface DadaProviderConfig {
    appKey: string;
    appSecret: string;
    shopNo: string;
    sourceId?: string;
    environment: 'sandbox' | 'production';
    callbackUrl: string;
}
/** 达达订单状态码 → 本地 DeliveryStatus（单一事实源，spec 复用） */
export declare const DADA_STATUS_MAP: Record<number, DeliveryStatus>;
/** 达达同城配送 Provider：契约层按官方文档固化，无凭据也可验证入站全链路 */
export declare class DadaDeliveryProvider implements DeliveryProvider {
    private readonly config;
    readonly code = "dada";
    readonly name = "\u8FBE\u8FBE\u540C\u57CE\u914D\u9001";
    private readonly http;
    constructor(config: DadaProviderConfig, http?: DadaHttpAdapter);
    /** 校验达达回调报文签名（用本 Provider 的 appSecret） */
    verifyCallback(payload: unknown): boolean;
    quote(_ctx: RequestContext, req: DeliveryQuoteRequest): Promise<DeliveryQuote>;
    createDelivery(_ctx: RequestContext, req: DeliveryCreateRequest): Promise<DeliveryCreateResult>;
    cancelDelivery(_ctx: RequestContext, deliveryOrderNo: string, reason?: string): Promise<DeliveryCancelResult>;
    parseWebhook(payload: any): DeliveryStatusEvent;
    private request;
    private estimateWeight;
}
