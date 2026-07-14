import { Injectable } from '@nestjs/common';
import { AlipaySdk } from 'alipay-sdk';
import { AlipayPluginOptions } from './types';

@Injectable()
export class AlipayAuthService {
    private sdk: AlipaySdk | null = null;

    constructor(private options: AlipayPluginOptions) {}

    private getSdk(): AlipaySdk {
        if (!this.sdk) {
            const authConfig = this.options.auth || {};
            this.sdk = new AlipaySdk({
                appId: authConfig.appId || '',
                privateKey: authConfig.privateKey || '',
                signType: 'RSA2',
                alipayPublicKey: this.options.alipayPublicKey,
            });
        }
        return this.sdk;
    }

    async getOpenidByAuthCode(authCode: string): Promise<string> {
        const sdk = this.getSdk();
        const result = await sdk.exec('alipay.system.oauth.auth', {
            grantType: 'authorization_code',
            code: authCode,
        });
        return (result as any).userId || (result as any).openId;
    }
}
