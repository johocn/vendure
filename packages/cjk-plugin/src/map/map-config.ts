// e:\code\vendure\packages\cjk-plugin\src\map\map-config.ts
export interface MapProviderConfig {
    provider: 'amap' | 'tencent' | 'baidu';
    apiKey: string;
    securityJsCode?: string;
}
