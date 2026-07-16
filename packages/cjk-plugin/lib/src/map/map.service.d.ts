import { ChannelService, RequestContext } from '@vendure/core';
import { DistrictNode, ReverseGeocodeResult } from './map-provider';
import { MapProviderRegistry } from './map-provider-registry';
export declare class MapService {
    private registry;
    private channelService;
    constructor(registry: MapProviderRegistry, channelService: ChannelService);
    /**
     * 从当前 Channel 的 customFields.mapConfig 读取配置
     * 如果当前 Channel 未配置，回退到默认 Channel
     */
    private getConfigForChannel;
    /**
     * 包装 provider 调用，捕获 i18n 错误并翻译
     */
    private callProvider;
    private getProvider;
    /**
     * 掩码 apiKey，用于 channelMapConfig 查询（展示用）
     */
    maskApiKey(key: string): string;
    getDistricts(ctx: RequestContext, parentAdcode: string | null): Promise<DistrictNode[]>;
    reverseGeocode(ctx: RequestContext, lat: number, lng: number): Promise<ReverseGeocodeResult>;
    getSdkConfig(ctx: RequestContext): Promise<{
        provider: string;
        sdkUrl: string;
        hasConfigured: boolean;
    }>;
    getChannelMapConfig(ctx: RequestContext): Promise<{
        provider: string;
        apiKey: string;
        hasConfigured: boolean;
    }>;
}
