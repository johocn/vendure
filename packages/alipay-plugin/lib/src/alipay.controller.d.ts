import { Request, Response } from 'express';
import { OrderService, ChannelService } from '@vendure/core';
import { AlipayPluginOptions } from './types';
export declare class AlipayController {
    private options;
    private orderService;
    private channelService;
    constructor(options: AlipayPluginOptions, orderService: OrderService, channelService: ChannelService);
    notify(req: Request, res: Response, body: any): Promise<void>;
}
