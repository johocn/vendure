import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService } from '@vendure/core';
import { encrypt } from '../auth/crypto';

export interface ServiceNotifyConfig {
    wecomEnabled?: boolean;
    wecomAgentId?: string;
    wecomCorpId?: string;
    wecomCorpSecret?: string;
    wechatPushEnabled?: boolean;
    wechatPushTemplate?: { orderCreated?: string; orderShipped?: string; orderAfterSale?: string };
    chatChannelEnabled?: boolean;
}

interface ServiceNotifyConfigStruct {
    wecomEnabled?: boolean | null;
    wecomAgentId?: string | null;
    wecomCorpId?: string | null;
    wecomCorpSecret?: string | null;
    wechatPushEnabled?: boolean | null;
    wechatPushTemplateJson?: string | null;
    chatChannelEnabled?: boolean | null;
}

function parseJson<T>(value: string | null | undefined): T | undefined {
    if (!value) return undefined;
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

function stringify(value: unknown): string | null {
    return value == null ? null : JSON.stringify(value);
}

@Injectable()
export class ServiceNotifyConfigService {
    constructor(private channelService: ChannelService) {}

    private parseStruct(raw: ServiceNotifyConfigStruct | undefined): ServiceNotifyConfig | null {
        if (!raw) return null;
        const out: ServiceNotifyConfig = {};
        if (raw.wecomEnabled != null) out.wecomEnabled = raw.wecomEnabled;
        if (raw.wecomAgentId != null) out.wecomAgentId = raw.wecomAgentId;
        if (raw.wecomCorpId != null) out.wecomCorpId = raw.wecomCorpId;
        if (raw.wecomCorpSecret != null) out.wecomCorpSecret = raw.wecomCorpSecret;
        if (raw.wechatPushEnabled != null) out.wechatPushEnabled = raw.wechatPushEnabled;
        if (raw.chatChannelEnabled != null) out.chatChannelEnabled = raw.chatChannelEnabled;
        const template = parseJson<NonNullable<ServiceNotifyConfig['wechatPushTemplate']>>(raw.wechatPushTemplateJson);
        if (template) out.wechatPushTemplate = template;
        return Object.keys(out).length > 0 ? out : null;
    }

    private serializeDomain(domain: ServiceNotifyConfig | null): ServiceNotifyConfigStruct {
        return {
            wecomEnabled: domain?.wecomEnabled ?? null,
            wecomAgentId: domain?.wecomAgentId ?? null,
            wecomCorpId: domain?.wecomCorpId ?? null,
            wecomCorpSecret: domain?.wecomCorpSecret ?? null,
            wechatPushEnabled: domain?.wechatPushEnabled ?? null,
            wechatPushTemplateJson: stringify(domain?.wechatPushTemplate),
            chatChannelEnabled: domain?.chatChannelEnabled ?? null,
        };
    }

    private mask(raw: ServiceNotifyConfig): ServiceNotifyConfig {
        return { ...raw, wecomCorpSecret: raw.wecomCorpSecret ? '***' : undefined };
    }

    async getMasked(ctx: RequestContext, channelId: string): Promise<ServiceNotifyConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = ((channel as any).customFields?.serviceNotifyConfig as ServiceNotifyConfigStruct | undefined);
        const domain = this.parseStruct(raw);
        if (!domain) return null;
        return this.mask(domain);
    }

    async update(
        ctx: RequestContext,
        channelId: string,
        patch: ServiceNotifyConfig | null,
    ): Promise<ServiceNotifyConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const original = this.parseStruct(((channel as any).customFields?.serviceNotifyConfig as ServiceNotifyConfigStruct | undefined)) || {};
        const incoming: ServiceNotifyConfig = { ...(patch || {}) };
        // 保留密码：前端传 *** 则保留原加密值
        if (incoming.wecomCorpSecret === '***' && original.wecomCorpSecret) {
            incoming.wecomCorpSecret = original.wecomCorpSecret;
        } else if (incoming.wecomCorpSecret) {
            incoming.wecomCorpSecret = encrypt(incoming.wecomCorpSecret);
        }
        const merged: ServiceNotifyConfig = { ...original, ...incoming };
        await this.channelService.update(ctx, { id: channelId as any, customFields: { serviceNotifyConfig: this.serializeDomain(merged) } });
        return this.mask(merged);
    }
}