import { Controller, Post } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '@vendure/core';
import { WechatInboundMessage } from '@vendure/wechat-auth-plugin';

import { AssistantService } from './assistant.service';
import { loggerCtx } from './constants';

/**
 * strapi zhao-sso 公众号回调转调接口：
 *   POST /shop-api/wechat-assistant/handle
 *   header: x-zhao-secret（与 strapi 端 ZHAO_SEARCH_SHARED_SECRET 同值）
 *   body:   { openid, text, msgId?, createTime?, channelToken? }
 *   返回:   { kind: 'text', content } | { kind: 'news', articles: [{title,description,pic_url,url}] }
 *           | { handled: false }（无需回复，sso 回 success）
 *
 * 回复由 sso 侧组装被动回复 XML（受微信 5 秒窗口约束，本接口必须快速返回）。
 * 微信直连回调链路（/shop-api/wechat/message → 事件总线 → 客服消息）保留为备选，
 * 公众号后台只能配一个回调 URL，生产走 sso 链路。
 */
@Controller('wechat-assistant')
export class AssistantHttpController {
    constructor(private assistantService: AssistantService) {}

    @Post('handle')
    async handle(req: Request & { body?: any }, res: Response): Promise<void> {
        const secret = process.env.ZHAO_SEARCH_SHARED_SECRET;
        if (!secret || (req.headers as any)['x-zhao-secret'] !== secret) {
            res.status(403).json({ handled: false, error: 'invalid secret' });
            return;
        }
        const body = (req.body || {}) as Record<string, any>;
        const openid = String(body.openid || body.fromUserName || '');
        const text = typeof body.text === 'string' ? body.text : '';
        if (!openid || !text) {
            res.status(400).json({ handled: false, error: 'openid and text are required' });
            return;
        }
        const msg: WechatInboundMessage = {
            channelToken: String(body.channelToken || ''),
            msgType: 'text',
            fromUserName: openid,
            toUserName: '',
            content: text,
            msgId: body.msgId != null ? String(body.msgId) : undefined,
            createTime: body.createTime != null ? Number(body.createTime) : undefined,
        };
        try {
            const out = await this.assistantService.processMessage(msg);
            if (!out) {
                res.json({ handled: false });
                return;
            }
            if (out.kind === 'news') {
                res.json({
                    kind: 'news',
                    articles: (out as any).articles.map((a: any) => ({
                        title: a.title,
                        description: a.description,
                        pic_url: a.picurl,
                        url: a.url,
                    })),
                });
                return;
            }
            res.json({ kind: 'text', content: out.content ?? '' });
        } catch (e) {
            Logger.error(`Assistant http handle failed: ${String(e)}`, loggerCtx);
            res.json({ handled: false });
        }
    }
}
