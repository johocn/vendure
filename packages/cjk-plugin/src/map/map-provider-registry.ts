// e:\code\vendure\packages\cjk-plugin\src\map\map-provider-registry.ts
import { Injectable } from '@nestjs/common';
import { MapProvider } from './map-provider';
import { AmapProvider } from './providers/amap-provider';
import { TencentProvider } from './providers/tencent-provider';
import { BaiduProvider } from './providers/baidu-provider';

@Injectable()
export class MapProviderRegistry {
    private providers = new Map<string, MapProvider>();

    constructor() {
        this.register(new AmapProvider());
        this.register(new TencentProvider());
        this.register(new BaiduProvider());
    }

    register(provider: MapProvider): void {
        this.providers.set(provider.name, provider);
    }

    /**
     * 获取 provider。若未注册抛出带 i18n key 的错误对象（由调用方翻译）。
     */
    get(name: string): MapProvider {
        const provider = this.providers.get(name);
        if (!provider) {
            // 抛出带 i18n key 的错误，调用方用 translateError 翻译
            const err = new Error(name) as any;
            err.i18nKey = 'MAP_PROVIDER_NOT_REGISTERED';
            err.i18nVars = { provider: name };
            throw err;
        }
        return provider;
    }
}
