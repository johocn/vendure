import { Request, Response } from 'express';
import { OrderService, ChannelService } from '@vendure/core';
import { WechatpayPluginOptions } from './types';
export declare class WechatpayController {
    private options;
    private orderService;
    private channelService;
    constructor(options: WechatpayPluginOptions, orderService: OrderService, channelService: ChannelService);
    notify(req: Request, res: Response, body: any): Promise<void>;
}
