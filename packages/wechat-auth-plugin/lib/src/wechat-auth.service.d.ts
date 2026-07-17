import { WechatAuthPluginOptions } from './types';
export declare class WechatAuthService {
    private options;
    private accessTokenCache;
    private miniProgramTokenCacheMap;
    private miniProgramTokenPromiseMap;
    private ticketCache;
    private accessTokenPromise;
    private ticketPromise;
    private readonly REFRESH_BUFFER_SECONDS;
    constructor(options: WechatAuthPluginOptions);
    getAccessToken(): Promise<string>;
    getJsapiTicket(): Promise<string>;
    getMiniProgramAccessToken(appId: string, appSecret: string): Promise<string>;
    private fetchAccessTokenByCredentials;
    generateJsapiSignature(url: string): Promise<{
        appId: string;
        timestamp: number;
        nonceStr: string;
        signature: string;
    }>;
    private fetchAccessToken;
    private fetchJsapiTicket;
    private generateNonceStr;
}
