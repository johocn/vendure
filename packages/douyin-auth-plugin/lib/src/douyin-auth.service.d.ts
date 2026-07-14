import { DouyinAuthPluginOptions } from './types';
export declare class DouyinAuthService {
    private options;
    constructor(options: DouyinAuthPluginOptions);
    getOpenidByCode(code: string): Promise<string>;
}
