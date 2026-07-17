import { AlipayPluginOptions } from './types';
export declare class AlipayAuthService {
    private options;
    private sdk;
    constructor(options: AlipayPluginOptions);
    private getSdk;
    getOpenidByAuthCode(authCode: string): Promise<string>;
}
