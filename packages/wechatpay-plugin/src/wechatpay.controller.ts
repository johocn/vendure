import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger, OrderService, ChannelService, RequestContext } from '@vendure/core';

import { WECHATPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { WechatpayPluginOptions } from './types';

@Controller('wechatpay')
export class WechatpayController {
    constructor(
        @Inject(WECHATPAY_PLUGIN_OPTIONS) private options: WechatpayPluginOptions,
        private orderService: OrderService,
        private channelService: ChannelService,
    ) {}

    @Post('notify')
    async notify(@Req() req: Request, @Res() res: Response, @Body() body: any) {
        try {
            const eventType = body?.event_type;

            if (eventType === 'TRANSACTION.SUCCESS') {
                const resource = body?.resource;
                const ciphertext = resource?.ciphertext;
                const outTradeNo = ciphertext?.out_trade_no;
                const transactionId = ciphertext?.transaction_id;

                Logger.info(`WeChat Pay trade success: ${outTradeNo}, txId: ${transactionId}`, loggerCtx);

                if (outTradeNo) {
                    try {
                        const channel = await this.channelService.getDefaultChannel();
                        const ctx = new RequestContext({
                            apiType: 'admin',
                            channel,
                            isAuthorized: true,
                            authorizedAsOwnerOnly: false,
                        });

                        const order = await this.orderService.findOneByCode(ctx, outTradeNo);
                        if (order && order.active) {
                            const payments = order.payments || [];
                            for (const payment of payments) {
                                if (payment.state === 'Authorized') {
                                    await this.orderService.settlePayment(ctx, payment.id);
                                    Logger.info(`Settled payment ${payment.id} for order ${outTradeNo}`, loggerCtx);
                                }
                            }
                        }
                    } catch (e: any) {
                        Logger.error(`Failed to settle payment for order ${outTradeNo}: ${e.message}`, loggerCtx);
                    }
                }
            }

            res.status(200).json({ code: 'SUCCESS', message: 'OK' });
        } catch (e: any) {
            Logger.error(`WeChat Pay notify error: ${e.message}`, loggerCtx);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }
}
