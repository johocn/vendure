import { Inject, Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import * as crypto from 'crypto';
import { WechatAuthPluginOptions } from './types';
import { WECHAT_AUTH_PLUGIN_OPTIONS } from './constants';
import { loggerCtx } from './constants';

interface TokenCache {
    token: string;
    expiresAt: number;
}

@Injectable()
export class WechatAuthService {
    private accessTokenCache: TokenCache | null = null;
    private ticketCache: TokenCache | null = null;
    private accessTokenPromise: Promise<string> | null = null;
    private ticketPromise: Promise<string> | null = null;
    private readonly REFRESH_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

    constructor(@Inject(WECHAT_AUTH_PLUGIN_OPTIONS) private options: WechatAuthPluginOptions) {}

    async getAccessToken(): Promise<string> {
        if (this.accessTokenCache && Date.now() < this.accessTokenCache.expiresAt) {
            return this.accessTokenCache.token;
        }
        if (this.accessTokenPromise) return this.accessTokenPromise;
        this.accessTokenPromise = this.fetchAccessToken().finally(() => {
            this.accessTokenPromise = null;
        });
        return this.accessTokenPromise;
    }

    async getJsapiTicket(): Promise<string> {
        if (this.ticketCache && Date.now() < this.ticketCache.expiresAt) {
            return this.ticketCache.token;
        }
        if (this.ticketPromise) return this.ticketPromise;
        this.ticketPromise = this.fetchJsapiTicket().finally(() => {
            this.ticketPromise = null;
        });
        return this.ticketPromise;
    }

    async generateJsapiSignature(url: string): Promise<{
        appId: string;
        timestamp: number;
        nonceStr: string;
        signature: string;
    }> {
        const ticket = await this.getJsapiTicket();
        const timestamp = Math.floor(Date.now() / 1000);
        const nonceStr = this.generateNonceStr();
        const raw = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
        const signature = crypto.createHash('sha1').update(raw).digest('hex');
        return {
            appId: this.options.appId,
            timestamp,
            nonceStr,
            signature,
        };
    }

    private async fetchAccessToken(): Promise<string> {
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.options.appId}&secret=${this.options.appSecret}`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        if (data.access_token) {
            this.accessTokenCache = {
                token: data.access_token,
                expiresAt: Date.now() + (data.expires_in - this.REFRESH_BUFFER_SECONDS) * 1000,
            };
            Logger.info(`WeChat access_token refreshed, expires in ${data.expires_in}s`, loggerCtx);
            return data.access_token;
        }
        Logger.error(`Failed to get access_token: ${JSON.stringify(data)}`, loggerCtx);
        throw new Error('Failed to get WeChat access_token');
    }

    private async fetchJsapiTicket(): Promise<string> {
        const accessToken = await this.getAccessToken();
        const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        if (data.ticket) {
            this.ticketCache = {
                token: data.ticket,
                expiresAt: Date.now() + (data.expires_in - this.REFRESH_BUFFER_SECONDS) * 1000,
            };
            Logger.info(`WeChat jsapi_ticket refreshed, expires in ${data.expires_in}s`, loggerCtx);
            return data.ticket;
        }
        Logger.error(`Failed to get jsapi_ticket: ${JSON.stringify(data)}`, loggerCtx);
        throw new Error('Failed to get WeChat jsapi_ticket');
    }

    private generateNonceStr(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }
}
