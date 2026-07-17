import * as crypto from 'crypto';
import { Controller, Get, Post, Query, Body, BadRequestException } from '@nestjs/common';
import { RequestContext, ChannelService } from '@vendure/core';
import { getAuthOverride } from '@vendure/cjk-plugin';
import { WechatAuthPlugin } from './plugin';
import { decryptMessage, verifySignature } from './wechat-message-crypto';

@Controller('wechat/message')
export class WechatMessageController {
    constructor(private channelService: ChannelService) {}

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
        const encrypted = body?.Encrypt;
        if (!encrypted) {
            return 'success';
        }
        if (query.encrypt_type === 'aes') {
            if (!query.msg_signature) throw new BadRequestException('Missing msg_signature');
            if (!verifySignature(token, query.timestamp!, query.nonce!, query.msg_signature, encrypted)) {
                throw new BadRequestException('Signature verification failed');
            }
            const xml = decryptMessage(token, encodingAESKey, appId, encrypted);
            // TODO: 解析 xml,路由到内部 handler(关注/菜单点击/消息等)
            return 'success';
        }
        return 'success';
    }
}
