import { RequestContext } from '@vendure/core';
import { DeliveryCreateRequest, DeliveryCreateResult, DeliveryCancelResult, DeliveryProvider, DeliveryQuote, DeliveryQuoteRequest, DeliveryStatusEvent } from './delivery-provider';
/** 模拟配送商：本地闭环验证用，接单/取货/送达由后台模拟接口触发 */
export declare class MockDeliveryProvider implements DeliveryProvider {
    readonly code = "mock";
    readonly name = "\u6A21\u62DF\u914D\u9001\u5546";
    quote(_ctx: RequestContext, req: DeliveryQuoteRequest): Promise<DeliveryQuote>;
    createDelivery(_ctx: RequestContext, req: DeliveryCreateRequest): Promise<DeliveryCreateResult>;
    cancelDelivery(_ctx: RequestContext, _deliveryOrderNo: string, reason?: string): Promise<DeliveryCancelResult>;
    parseWebhook(payload: any): DeliveryStatusEvent;
    private approxKm;
}
