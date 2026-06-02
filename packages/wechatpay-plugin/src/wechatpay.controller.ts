import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger, PaymentService } from '@vendure/core';

import { WECHATPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { WechatpayPluginOptions } from './types';

@Controller('wechatpay')
export class WechatpayController {
    constructor(
        @Inject(WECHATPAY_PLUGIN_OPTIONS) private options: WechatpayPluginOptions,
        private paymentService: PaymentService,
    ) {}

    @Post('notify')
    async notify(@Req() req: Request, @Res() res: Response, @Body() body: any) {
        try {
            const { event_type, resource } = body;

            if (event_type === 'TRANSACTION.SUCCESS') {
                const outTradeNo = resource?.ciphertext?.out_trade_no;
                const transactionId = resource?.ciphertext?.transaction_id;
                Logger.info(`WeChat Pay trade success: ${outTradeNo}, txId: ${transactionId}`, loggerCtx);
            }

            res.status(200).json({ code: 'SUCCESS', message: 'OK' });
        } catch (e: any) {
            Logger.error(`WeChat Pay notify error: ${e.message}`, loggerCtx);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }
}
