import { Request, Response } from 'express';
import { PaymentService, ChannelService } from '@vendure/core';
import { AlipayPluginOptions } from './types';
export declare class AlipayController {
    private options;
    private paymentService;
    private channelService;
    constructor(options: AlipayPluginOptions, paymentService: PaymentService, channelService: ChannelService);
    notify(req: Request, res: Response, body: any): Promise<void>;
}
