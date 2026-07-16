import { MapProvider } from './map-provider';
export declare class MapProviderRegistry {
    private providers;
    constructor();
    register(provider: MapProvider): void;
    /**
     * 获取 provider。若未注册抛出带 i18n key 的错误对象（由调用方翻译）。
     */
    get(name: string): MapProvider;
}
