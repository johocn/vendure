import { Request, Response } from 'express';
import { PaymentService } from '@vendure/core';
import { WechatpayPluginOptions } from './types';
export declare class WechatpayController {
    private options;
    private paymentService;
    constructor(options: WechatpayPluginOptions, paymentService: PaymentService);
    notify(req: Request, res: Response, body: any): Promise<void>;
}
