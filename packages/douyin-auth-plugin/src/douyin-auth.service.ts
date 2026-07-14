import { Injectable } from '@nestjs/common';
import { DouyinAuthPluginOptions } from './types';

@Injectable()
export class DouyinAuthService {
    constructor(private options: DouyinAuthPluginOptions) {}

    async getOpenidByCode(code: string): Promise<string> {
        const appId = this.options.miniProgramAppId || this.options.appId;
        const secret = this.options.miniProgramAppSecret || this.options.appSecret;
        const response = await fetch('https://developer.toutiao.com/api/apps/v2/jscode2session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appid: appId, secret, code }),
        });
        const data = (await response.json()) as any;
        return data.openid;
    }
}
