import { Injectable } from '@nestjs/common';
import { AlipaySdk } from 'alipay-sdk';
import { AlipayPluginOptions } from './types';

@Injectable()
export class AlipayAuthService {
    private sdk: AlipaySdk | null = null;

    constructor(private options: AlipayPluginOptions) {}

    private getSdk(authOverride?: { appId?: string; privateKey?: string }): AlipaySdk {
        if (authOverride && (authOverride.appId || authOverride.privateKey)) {
            // 租户覆盖：per-request 构造 SDK，不缓存
            return new AlipaySdk({
                appId: authOverride.appId || '',
                privateKey: authOverride.privateKey || '',
                signType: 'RSA2',
                alipayPublicKey: this.options.alipayPublicKey,
            });
        }
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

    async getOpenidByAuthCode(authCode: string, authOverride?: { appId?: string; privateKey?: string }): Promise<string> {
        const sdk = this.getSdk(authOverride);
        const result = await sdk.exec('alipay.system.oauth.auth', {
            grantType: 'authorization_code',
            code: authCode,
        });
        return (result as any).userId || (result as any).openId;
    }
}
