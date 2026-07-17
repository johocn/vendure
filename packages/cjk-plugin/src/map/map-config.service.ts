// packages/cjk-plugin/src/map/map-config.service.ts
import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService } from '@vendure/core';
import { encryptMapConfig, decryptMapConfig, maskMapConfig, mergeMapConfig } from './map-crypto';
import type { MapProviderConfig } from './map-config';

@Injectable()
export class MapConfigService {
    constructor(private channelService: ChannelService) {}

    async getMasked(ctx: RequestContext, channelId: string): Promise<MapProviderConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = (channel as any).customFields?.mapConfig as MapProviderConfig | undefined;
        if (!raw) return null;
        return maskMapConfig(decryptMapConfig(raw));
    }

    async getDecrypted(ctx: RequestContext, channelId: string): Promise<MapProviderConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = (channel as any).customFields?.mapConfig as MapProviderConfig | undefined;
        if (!raw) return null;
        return decryptMapConfig(raw);
    }

    async update(ctx: RequestContext, channelId: string, patch: Partial<MapProviderConfig> | null): Promise<MapProviderConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = (channel as any).customFields?.mapConfig as MapProviderConfig | undefined;
        const original = decryptMapConfig(raw || null);
        const merged = mergeMapConfig(original, patch);
        const encrypted = encryptMapConfig(merged);
        await this.channelService.update(ctx, { id: channelId as any, customFields: { mapConfig: encrypted } });
        return this.getMasked(ctx, channelId);
    }
}
