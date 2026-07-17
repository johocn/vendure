// packages/cjk-plugin/src/payment/pay-config.service.ts
import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService } from '@vendure/core';
import { encryptPayConfig, decryptPayConfig, maskPayConfig, mergePayConfig } from './pay-config-crypto';
import type { PayConfig, PayConfigStruct } from './payment-config.types';

@Injectable()
export class PayConfigService {
    constructor(private channelService: ChannelService) {}

    private parseStruct(raw: PayConfigStruct | undefined): PayConfig | null {
        if (!raw) return null;
        const out: PayConfig = {};
        if (raw.alipayJson) { try { out.alipay = JSON.parse(raw.alipayJson); } catch {} }
        if (raw.wechatpayJson) { try { out.wechatpay = JSON.parse(raw.wechatpayJson); } catch {} }
        if (raw.douyinpayJson) { try { out.douyinpay = JSON.parse(raw.douyinpayJson); } catch {} }
        return Object.keys(out).length > 0 ? out : null;
    }

    private serializeDomain(domain: PayConfig | null): PayConfigStruct {
        return {
            alipayJson: domain?.alipay ? JSON.stringify(domain.alipay) : '',
            wechatpayJson: domain?.wechatpay ? JSON.stringify(domain.wechatpay) : '',
            douyinpayJson: domain?.douyinpay ? JSON.stringify(domain.douyinpay) : '',
        };
    }

    async getMasked(ctx: RequestContext, channelId: string): Promise<PayConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = (channel as any).customFields?.payConfig as PayConfigStruct | undefined;
        const domain = this.parseStruct(raw);
        return maskPayConfig(decryptPayConfig(domain));
    }

    async update(ctx: RequestContext, channelId: string, patch: Partial<PayConfig> | null): Promise<PayConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = (channel as any).customFields?.payConfig as PayConfigStruct | undefined;
        const original = decryptPayConfig(this.parseStruct(raw));
        const merged = mergePayConfig(original, patch);
        const encrypted = encryptPayConfig(merged);
        const newStruct = this.serializeDomain(encrypted);
        await this.channelService.update(ctx, { id: channelId as any, customFields: { payConfig: newStruct } });
        return this.getMasked(ctx, channelId);
    }
}
