import { MeituanSignMode } from './meituan-signature';
export interface MeituanHttpConfig {
    appKey: string;
    appSecret: string;
    signMode: MeituanSignMode;
    baseUrl?: string;
    timeoutMs?: number;
}
/** 美团开放平台 HTTP：application/x-www-form-urlencoded，统一错误归一 */
export declare class MeituanHttpAdapter {
    private config;
    constructor(config: MeituanHttpConfig);
    private get baseUrl();
    post<T = any>(path: string, body: Record<string, unknown>): Promise<T>;
}
