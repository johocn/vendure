import { Injectable } from '@nestjs/common';
import { DouyinAuthPluginOptions } from './types';

@Injectable()
export class DouyinAuthService {
    constructor(private options: DouyinAuthPluginOptions) {}

    async getOpenidByCode(
        code: string,
        appId: string,
        appSecret: string,
        miniProgramAppId?: string,
        miniProgramAppSecret?: string,
    ): Promise<string> {
        const finalAppId = miniProgramAppId || appId;
        const finalSecret = miniProgramAppSecret || appSecret;
        const response = await fetch('https://developer.toutiao.com/api/apps/v2/jscode2session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appid: finalAppId, secret: finalSecret, code }),
        });
        const data = (await response.json()) as any;
        return data.openid;
    }
}
