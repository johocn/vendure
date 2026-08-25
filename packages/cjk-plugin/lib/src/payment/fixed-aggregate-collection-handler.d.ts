import { PaymentMethodHandler } from '@vendure/core';
/**
 * 固定聚合码收款处理器（门店到店收银）
 *
 * 门店到店收银：顾客扫码商家固定的聚合收款码（微信/支付宝）付款到商户，
 * 店员确认到账后完成订单。离线自确认，不经第三方网关回调，与到店收银一致。
 */
export declare const fixedAggregateCollectionHandler: PaymentMethodHandler<{}>;
