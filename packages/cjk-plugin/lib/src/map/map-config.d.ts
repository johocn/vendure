export interface MapProviderConfig {
    provider: 'amap' | 'tencent' | 'baidu';
    apiKey: string;
    securityJsCode?: string;
}
