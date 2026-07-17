import { RequestContext } from '@vendure/core';
import { AlipayCredentials, DouyinpayCredentials, PayConfig, PayConfigStruct, PaymentMethodCode, WechatpayCredentials } from './payment-config.types';

export function readChannelPayConfig(ctx: RequestContext): PayConfig | null {
    const raw = (ctx.channel as any)?.customFields?.payConfig as PayConfigStruct | undefined;
    if (!raw) return null;

    const result: PayConfig = {};

    if (raw.alipayJson) {
        try {
            result.alipay = JSON.parse(raw.alipayJson);
        } catch {}
    }

    if (raw.wechatpayJson) {
        try {
            result.wechatpay = JSON.parse(raw.wechatpayJson);
        } catch {}
    }

    if (raw.douyinpayJson) {
        try {
            result.douyinpay = JSON.parse(raw.douyinpayJson);
        } catch {}
    }

    return Object.keys(result).length > 0 ? result : null;
}

export function getPaymentOverride(
    ctx: RequestContext,
    method: PaymentMethodCode,
): AlipayCredentials | WechatpayCredentials | DouyinpayCredentials | null {
    try {
        const config = readChannelPayConfig(ctx);
        if (!config) return null;
        return config[method] || null;
    } catch {
        return null;
    }
}
