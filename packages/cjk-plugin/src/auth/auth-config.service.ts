// packages/cjk-plugin/src/auth/auth-config.service.ts
import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService } from '@vendure/core';
import { parseAndDecryptStruct, maskAuthConfig, mergeAuthConfig, serializeAuthConfigToStruct } from './crypto';
import type { TenantAuthConfigMasked } from './auth-config.types';

@Injectable()
export class AuthConfigService {
    constructor(private channelService: ChannelService) {}

    async getMasked(ctx: RequestContext, channelId: string): Promise<TenantAuthConfigMasked | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const rawStruct = (channel as any).customFields?.authConfig;
        if (!rawStruct) return null;
        const domain = parseAndDecryptStruct(rawStruct);
        return maskAuthConfig(domain) as TenantAuthConfigMasked;
    }

    async update(ctx: RequestContext, channelId: string, patch: any): Promise<TenantAuthConfigMasked | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const originalStruct = (channel as any).customFields?.authConfig;
        const originalDomain = originalStruct ? parseAndDecryptStruct(originalStruct) : null;
        const merged = mergeAuthConfig(originalDomain, patch);
        const newStruct = serializeAuthConfigToStruct(merged);
        await this.channelService.update(ctx, { id: channelId as any, customFields: { authConfig: newStruct } });
        return this.getMasked(ctx, channelId);
    }
}
