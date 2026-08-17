// e:\code\vendure\packages\cjk-plugin\src\map\map.service.ts
import { Injectable } from '@nestjs/common';
import { ChannelService, ID, RequestContext } from '@vendure/core';
import { MapProviderConfig } from './map-config';
import { decryptMapConfig } from './map-crypto';
import { DistrictNode, MapProvider, ReverseGeocodeResult } from './map-provider';
import { MapProviderRegistry } from './map-provider-registry';
import { translateError } from '../pickup/i18n-messages';

@Injectable()
export class MapService {
    constructor(
        private registry: MapProviderRegistry,
        private channelService: ChannelService,
    ) {}

    /**
     * 从 Channel 的 customFields.mapConfig 读取配置
     * - 传入 channelId 时读指定 channel
     * - 否则优先用当前 channel，回退到默认 Channel
     * 读出的 raw 加密 config 解密后再返回
     */
    private async getConfigForChannel(ctx: RequestContext, channelId?: string): Promise<MapProviderConfig | null> {
        let config: MapProviderConfig | undefined;
        if (channelId) {
            // 读指定 channel
            const channel = await this.channelService.findOne(ctx, channelId as any);
            config = (channel?.customFields as any)?.mapConfig as MapProviderConfig | undefined;
        } else {
            // 优先用当前 channel
            config = (ctx.channel?.customFields as any)?.mapConfig as MapProviderConfig | undefined;
            if (!config) {
                const defaultChannel = await this.channelService.getDefaultChannel(ctx);
                config = (defaultChannel?.customFields as any)?.mapConfig as MapProviderConfig | undefined;
            }
        }
        // 解密后返回(加密格式 enc:xxx → 明文)
        const decrypted = config ? decryptMapConfig(config) : null;
        // 配置存在但缺少有效 provider（如后台误存空对象）时视为未配置，避免 registry.get(undefined) 抛错
        if (decrypted && !decrypted.provider) return null;
        return decrypted;
    }

    /**
     * 包装 provider 调用，捕获 i18n 错误并翻译
     */
    private async callProvider<T>(
        ctx: RequestContext,
        fn: () => Promise<T>,
    ): Promise<T> {
        try {
            return await fn();
        } catch (err: any) {
            if (err?.i18nKey === 'MAP_PROVIDER_NOT_REGISTERED') {
                const vars = err.i18nVars ?? {};
                const msg = translateError(ctx, 'MAP_PROVIDER_NOT_REGISTERED')
                    .replace('{provider}', vars.provider ?? '');
                throw new Error(msg);
            }
            // provider 内部抛出的普通 Error（含 HTTP 错误信息）
            const msg = translateError(ctx, 'MAP_PROVIDER_API_ERROR')
                .replace('{message}', err?.message ?? 'unknown');
            throw new Error(msg);
        }
    }

    private getProvider(config: MapProviderConfig): MapProvider {
        return this.registry.get(config.provider);
    }

    /**
     * 掩码 apiKey，用于 channelMapConfig 查询（展示用）
     */
    maskApiKey(key: string): string {
        if (key.length <= 8) return '****';
        return key.slice(0, 4) + '****' + key.slice(-4);
    }

    async getDistricts(ctx: RequestContext, parentAdcode: string | null): Promise<DistrictNode[]> {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            throw new Error(translateError(ctx, 'MAP_CONFIG_NOT_CONFIGURED'));
        }
        const provider = this.getProvider(config);
        return this.callProvider(ctx, () => provider.fetchDistricts(parentAdcode, config.apiKey));
    }

    async reverseGeocode(ctx: RequestContext, lat: number, lng: number): Promise<ReverseGeocodeResult> {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            throw new Error(translateError(ctx, 'MAP_CONFIG_NOT_CONFIGURED'));
        }
        const provider = this.getProvider(config);
        return this.callProvider(ctx, () => provider.reverseGeocode(lat, lng, config.apiKey));
    }

    async getSdkConfig(ctx: RequestContext): Promise<{ provider: string; sdkUrl: string; hasConfigured: boolean }> {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            return { provider: '', sdkUrl: '', hasConfigured: false };
        }
        const provider = this.getProvider(config);
        const sdkUrl = provider.getSdkLoaderUrl(config.apiKey, config.securityJsCode);
        return { provider: config.provider, sdkUrl, hasConfigured: true };
    }

    async getChannelMapConfig(ctx: RequestContext, channelId?: string): Promise<{ provider: string; apiKey: string; hasConfigured: boolean }> {
        const config = await this.getConfigForChannel(ctx, channelId);
        if (!config) {
            return { provider: '', apiKey: '', hasConfigured: false };
        }
        return {
            provider: config.provider,
            apiKey: this.maskApiKey(config.apiKey),
            hasConfigured: true,
        };
    }
}
