import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '@vendure/core';

import { WECHAT_AUTH_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { WechatAuthPluginOptions } from './types';

@Controller('wechat-auth')
export class WechatAuthController {
    constructor(@Inject(WECHAT_AUTH_PLUGIN_OPTIONS) private options: WechatAuthPluginOptions) {}

    @Get('callback')
    async callback(@Req() req: Request, @Res() res: Response, @Query('code') code: string) {
        if (!code) {
            res.status(400).send('Missing code parameter');
            return;
        }

        try {
            const url =
                `https://api.weixin.qq.com/sns/oauth2/access_token` +
                `?appid=${this.options.appId}&secret=${this.options.appSecret}` +
                `&code=${code}&grant_type=authorization_code`;
            const response = await fetch(url);
            const data = await response.json() as any;

            if (data.openid) {
                Logger.info(`WeChat OAuth callback received for openid: ${String(data.openid)}`, loggerCtx);
                res.redirect(`/?wechat_code=${code}&openid=${String(data.openid)}`);
            } else {
                Logger.error(`WeChat OAuth callback failed: ${JSON.stringify(data)}`, loggerCtx);
                res.status(400).send('WeChat OAuth failed');
            }
        } catch (e: any) {
            Logger.error(`WeChat OAuth callback error: ${String(e.message)}`, loggerCtx);
            res.status(500).send('Internal error');
        }
    }
}
