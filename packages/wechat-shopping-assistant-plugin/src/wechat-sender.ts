import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { WechatAuthService } from '@vendure/wechat-auth-plugin';

import { loggerCtx } from './constants';
import { OutboundMessage, WechatCredentials } from './types';

/**
 * 微信出站消息封装：news 失败自动降级 text 由调用方编排。
 * outboundMode='echo' 时不调微信 API，仅打印 payload（本地冒烟用）。
 */
@Injectable()
export class WechatSender {
    private echoMode = false;

    constructor(private wechatAuth: WechatAuthService) {}

    /** 由插件初始化时按 options.outboundMode 注入 */
    setEchoMode(echo: boolean): void {
        this.echoMode = echo;
    }

    async send(message: OutboundMessage, credentials: WechatCredentials): Promise<void> {
        if (this.echoMode) {
            Logger.info(`[echo] outbound message: ${JSON.stringify(message)}`, loggerCtx);
            return;
        }
        // cred 仅在渠道覆盖了独立 appId/appSecret 时生效（wechat-auth-plugin 内部比对主 appId）
        const cred = credentials.appId && credentials.appSecret ? credentials : undefined;
        if (message.kind === 'text') {
            await this.wechatAuth.sendCustomText(message.touser, message.content, cred);
        } else {
            await this.wechatAuth.sendCustomNews(message.touser, message.articles, cred);
        }
    }

    /** news 发送失败（45166/40007 等）时自动降级纯文本 */
    async sendOrFallback(message: OutboundMessage, fallbackText: string, credentials: WechatCredentials): Promise<void> {
        try {
            await this.send(message, credentials);
        } catch (e) {
            Logger.warn(`Outbound ${message.kind} failed, fallback to text: ${String(e)}`, loggerCtx);
            await this.send({ kind: 'text', touser: message.touser, content: fallbackText }, credentials);
        }
    }
}
