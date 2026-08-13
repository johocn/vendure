import { AlipayPluginOptions } from './types';
export declare class AlipayAuthService {
    private options;
    private sdk;
    constructor(options: AlipayPluginOptions);
    private getSdk;
    getOpenidByAuthCode(authCode: string, authOverride?: {
        appId?: string;
        privateKey?: string;
    }): Promise<string>;
}
