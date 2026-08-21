import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import WxPay from 'wechatpay-node-v3';
import {
    Logger,
    OrderService,
    ChannelService,
    PaymentMethodService,
    RequestContext,
    RequestContextService,
} from '@vendure/core';
import { getPaymentOverride } from '@vendure/cjk-plugin';
import type { WechatpayCredentials } from '@vendure/cjk-plugin';

import { WECHATPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { WechatpayPluginOptions } from './types';
import { WechatpaySettlementRegistry } from './wechatpay-settlement';

@Controller('wechatpay')
export class WechatpayController {
    constructor(
        @Inject(WECHATPAY_PLUGIN_OPTIONS) private options: WechatpayPluginOptions,
        private orderService: OrderService,
        private channelService: ChannelService,
        private paymentMethodService: PaymentMethodService,
        private requestContextService: RequestContextService,
        private settlementRegistry: WechatpaySettlementRegistry,
    ) {}

    /** 结算路由：非订单前缀（如 RC-）交给注册的结算器，否则默认结 Vendure Order */
    private async routeSettlement(outTradeNo: string, transactionId: string): Promise<void> {
        const settlement = this.settlementRegistry.find(outTradeNo);
        if (settlement) {
            const channel = await this.channelService.getDefaultChannel();
            const ctx = new RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            await settlement.settle(ctx, outTradeNo, transactionId);
            return;
        }
        await this.settleOrderPayment(outTradeNo);
    }

    /**
     * 结算订单支付：dev-notify 和 notify 共用
     * 查询 Authorized 状态的支付并调用 settlePayment
     * 注意：订单到达 PaymentAuthorized 后 active=false，不能用 order.active 判断
     */
    private async settleOrderPayment(orderCode: string): Promise<void> {
        const channel = await this.channelService.getDefaultChannel();
        const ctx = new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const order = await this.orderService.findOneByCode(ctx, orderCode, ['payments']);
        if (!order) {
            Logger.warn(`settleOrderPayment: order ${orderCode} not found`, loggerCtx);
            return;
        }
        const payments = order.payments || [];
        for (const payment of payments) {
            if (payment.state === 'Authorized') {
                try {
                    await this.orderService.settlePayment(ctx, payment.id);
                    Logger.info(`Settled payment ${payment.id} for order ${orderCode}`, loggerCtx);
                } catch (e: any) {
                    Logger.error(`settlePayment failed for payment ${payment.id}: ${e.message}`, loggerCtx);
                }
            }
        }
    }

    /**
     * 从默认 channel 的 PaymentMethod args + channel override 构造 WxPay 实例
     * 用于通知回调中验签解密
     */
    private async buildWxPayFromDefaultChannel(): Promise<{
        pay: WxPay;
        apiKey: string;
    }> {
        const channel = await this.channelService.getDefaultChannel();
        const ctx = new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const override = getPaymentOverride(ctx, 'wechatpay') as WechatpayCredentials | null;
        const pms = await this.paymentMethodService.findAll(ctx);
        const pm = pms.items.find(p => p.code === 'wechatpay');
        const args = pm?.handler?.args || [];
        const getArg = (name: string) => args.find(a => a.name === name)?.value || '';
        const apiKey = override?.apiKey || getArg('apiKey');

        const pay = new WxPay({
            appid: override?.appId || getArg('appId'),
            mchid: override?.mchId || getArg('mchId'),
            publicKey: Buffer.from(override?.publicKey || getArg('publicKey')),
            privateKey: Buffer.from(override?.privateKey || getArg('privateKey')),
            key: apiKey,
            serial_no: override?.serialNo || getArg('serialNo'),
        });

        return { pay, apiKey };
    }

    /**
     * 生产环境：V3 通知验签 + AES-GCM 解密
     */
    @Post('notify')
    async notify(@Req() req: Request, @Res() res: Response, @Body() body: any) {
        try {
            const {
                'wechatpay-timestamp': timestamp,
                'wechatpay-nonce': nonce,
                'wechatpay-signature': signature,
                'wechatpay-serial': serial,
            } = req.headers as any;

            const resource = body?.resource;
            if (!resource) {
                return res.status(400).json({ code: 'FAIL', message: 'missing resource' });
            }

            const { pay, apiKey } = await this.buildWxPayFromDefaultChannel();

            // 1. 验签
            const bodyStr = JSON.stringify(body);
            const verified = pay.verifySign({
                timestamp,
                nonce,
                body: bodyStr,
                serial,
                signature,
                apiSecret: apiKey,
            });
            if (!verified) {
                Logger.warn('WeChat Pay notify signature verification failed', loggerCtx);
                return res.status(401).json({ code: 'FAIL', message: '签名验证失败' });
            }

            // 2. AES-GCM 解密
            const decrypted = pay.decipher_gcm(
                resource.ciphertext,
                resource.associated_data,
                resource.nonce,
            ) as { out_trade_no?: string; transaction_id?: string };
            const outTradeNo = decrypted?.out_trade_no;
            const transactionId = decrypted?.transaction_id;

            Logger.info(
                `WeChat Pay trade success: ${outTradeNo}, txId: ${transactionId}`,
                loggerCtx,
            );

            // 3. 处理支付结果
            if (body?.event_type === 'TRANSACTION.SUCCESS' && outTradeNo) {
                await this.routeSettlement(outTradeNo, transactionId || '');
            }

            res.status(200).json({ code: 'SUCCESS', message: 'OK' });
        } catch (e: any) {
            Logger.error(`WeChat Pay notify error: ${e.message}`, loggerCtx);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }

    /**
     * Dev Bypass: 模拟微信支付页面
     */
    @Get('dev-pay')
    getDevPayPage(@Req() req: Request, @Res() res: Response) {
        const outTradeNo = (req.query as any).outTradeNo as string;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>模拟微信支付</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
    <h2>模拟微信支付</h2>
    <p>订单号: ${outTradeNo}</p>
    <button onclick="pay()" style="padding:12px 40px;font-size:16px;background:#07c160;color:#fff;border:none;border-radius:4px;cursor:pointer;">
        模拟支付成功
    </button>
    <p id="msg" style="margin-top:20px;color:#666;"></p>
    <script>
        async function pay() {
            document.getElementById('msg').innerText = '正在处理...';
            try {
                const res = await fetch('/wechatpay/dev-notify?outTradeNo=${outTradeNo}', {
                    method: 'POST'
                });
                const data = await res.json();
                if (data.code === 'SUCCESS') {
                    document.body.innerHTML =
                        '<h2 style="color:#07c160">支付成功</h2>' +
                        '<p>订单: ${outTradeNo}</p>' +
                        '<a href="/" style="color:#576b95;">返回商城</a>';
                } else {
                    document.getElementById('msg').innerText = '支付失败: ' + (data.message || '未知错误');
                }
            } catch (e) {
                document.getElementById('msg').innerText = '请求失败: ' + e.message;
            }
        }
    </script>
</body>
</html>`);
    }

    /**
     * Dev Bypass: 自动回调，结算订单或走注册表结算
     */
    @Post('dev-notify')
    async devNotify(@Req() req: Request, @Res() res: Response) {
        const outTradeNo = (req.query as any).outTradeNo as string;
        try {
            if (!outTradeNo) {
                return res.status(400).json({ code: 'FAIL', message: 'missing outTradeNo' });
            }
            await this.routeSettlement(outTradeNo, 'DEV-TX');
            res.status(200).json({ code: 'SUCCESS', message: 'OK' });
        } catch (e: any) {
            Logger.error(`WeChat Pay dev-notify error: ${e.message}`, loggerCtx);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }
}
