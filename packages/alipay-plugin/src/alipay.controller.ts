import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger, PaymentService, RequestContext, ChannelService } from '@vendure/core';

import { ALIPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { AlipayPluginOptions } from './types';
import { AlipaySdk } from 'alipay-sdk';

@Controller('alipay')
export class AlipayController {
    constructor(
        @Inject(ALIPAY_PLUGIN_OPTIONS) private options: AlipayPluginOptions,
        private paymentService: PaymentService,
        private channelService: ChannelService,
    ) {}

    @Post('notify')
    async notify(@Req() req: Request, @Res() res: Response, @Body() body: any) {
        try {
            const sign = body.sign;
            const signType = body.sign_type || 'RSA2';

            const alipaySdk = new AlipaySdk({
                appId: body.app_id,
                privateKey: '',
                alipayPublicKey: this.options.alipayPublicKey,
                signType,
            });

            const verified = alipaySdk.checkNotifySign(body);
            if (!verified) {
                Logger.warn('Alipay notify signature verification failed', loggerCtx);
                res.send('fail');
                return;
            }

            const tradeStatus = body.trade_status;
            const outTradeNo = body.out_trade_no;

            if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
                Logger.info(`Alipay trade success: ${outTradeNo}`, loggerCtx);
            }

            res.send('success');
        } catch (e: any) {
            Logger.error(`Alipay notify error: ${e.message}`, loggerCtx);
            res.send('fail');
        }
    }
}
