import * as crypto from 'crypto';
import { Controller, Get, Post, Query, Body, BadRequestException } from '@nestjs/common';
import { EventBus, Logger, RequestContext, ChannelService } from '@vendure/core';
import { getAuthOverride } from '@vendure/cjk-plugin';
import { WechatAuthPlugin } from './plugin';
import { decryptMessage, verifySignature } from './wechat-message-crypto';
import { loggerCtx } from './constants';
import { parseWechatXml } from './wechat-xml';
import { WechatInboundMessage, WechatMessageEvent } from './wechat-message.events';

@Controller('wechat/message')
export class WechatMessageController {
    constructor(
        private channelService: ChannelService,
        private eventBus: EventBus,
    ) {}

    private async getCredentials(channelId: string) {
        const ctx = RequestContext.empty();
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) throw new BadRequestException('Invalid channel');
        const override = getAuthOverride({ channel } as any, 'wechat');
        const token = override?.token || WechatAuthPlugin.options?.token;
        const encodingAESKey = override?.encodingAESKey || WechatAuthPlugin.options?.encodingAESKey;
        const appId = override?.appId || WechatAuthPlugin.options?.appId;
        if (!token || !encodingAESKey || !appId) {
            throw new BadRequestException('WECHAT_MESSAGE_CRYPTO_NOT_CONFIGURED');
        }
        return { token, encodingAESKey, appId };
    }

    @Get()
    async verify(@Query() query: { signature?: string; timestamp?: string; nonce?: string; echostr?: string; channel?: string }) {
        if (!query.channel || !query.signature || !query.timestamp || !query.nonce || !query.echostr) {
            throw new BadRequestException('Missing required query params');
        }
        const { token } = await this.getCredentials(query.channel);
        const expected = [token, query.timestamp, query.nonce].sort().join('');
        const hash = crypto.createHash('sha1').update(expected).digest('hex');
        if (hash !== query.signature) throw new BadRequestException('Signature mismatch');
        return query.echostr;
    }

    @Post()
    async receive(@Query() query: { channel?: string; signature?: string; timestamp?: string; nonce?: string; encrypt_type?: string; msg_signature?: string }, @Body() body: any) {
        if (!query.channel) throw new BadRequestException('Missing channel');
        const { token, encodingAESKey, appId } = await this.getCredentials(query.channel);
        // body 由插件注册的 text/xml 中间件解析为字符串；兼容 JSON 转发（{Encrypt} 形式）
        const isXmlString = typeof body === 'string';
        let xml: Record<string, string>;
        if (query.encrypt_type === 'aes') {
            const encrypted = isXmlString ? parseWechatXml(body).Encrypt : body?.Encrypt;
            if (!encrypted) return 'success';
            if (!query.msg_signature) throw new BadRequestException('Missing msg_signature');
            if (!verifySignature(token, query.timestamp!, query.nonce!, query.msg_signature, encrypted)) {
                throw new BadRequestException('Signature verification failed');
            }
            xml = parseWechatXml(decryptMessage(token, encodingAESKey, appId, encrypted));
        } else {
            // 明文模式：直接解析 XML（微信要求 5 秒内应答，解析失败也回 success 避免重试风暴）
            xml = isXmlString ? parseWechatXml(body) : {};
        }
        if (!xml.FromUserName || !xml.MsgType) return 'success';
        const message: WechatInboundMessage = {
            channelToken: query.channel,
            msgType: xml.MsgType,
            fromUserName: xml.FromUserName,
            toUserName: xml.ToUserName ?? '',
            content: xml.Content,
            msgId: xml.MsgId,
            event: xml.Event,
            eventKey: xml.EventKey,
            createTime: xml.CreateTime ? Number(xml.CreateTime) : undefined,
        };
        try {
            this.eventBus.publish(new WechatMessageEvent(message));
        } catch (e) {
            Logger.error(`WechatMessageEvent publish failed: ${String(e)}`, loggerCtx);
        }
        return 'success';
    }
}
