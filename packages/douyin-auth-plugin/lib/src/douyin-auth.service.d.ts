import { DouyinAuthPluginOptions } from './types';
export declare class DouyinAuthService {
    private options;
    constructor(options: DouyinAuthPluginOptions);
    getOpenidByCode(code: string, appId: string, appSecret: string, miniProgramAppId?: string, miniProgramAppSecret?: string): Promise<string>;
}
