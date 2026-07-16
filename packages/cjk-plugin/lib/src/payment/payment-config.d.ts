import { RequestContext } from '@vendure/core';
import { AlipayCredentials, PayConfig, PaymentMethodCode, WechatpayCredentials } from './payment-config.types';
export declare function readChannelPayConfig(ctx: RequestContext): PayConfig | null;
export declare function getPaymentOverride(ctx: RequestContext, method: PaymentMethodCode): AlipayCredentials | WechatpayCredentials | null;
