import { Request, Response } from 'express';
import { WechatAuthPluginOptions } from './types';
export declare class WechatAuthController {
    private options;
    constructor(options: WechatAuthPluginOptions);
    callback(req: Request, res: Response, code: string): Promise<void>;
}
