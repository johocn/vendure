import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '@vendure/core';
import { WechatInboundMessage } from '@vendure/wechat-auth-plugin';

import { AssistantService } from './assistant.service';
import { loggerCtx } from './constants';

/**
 * strapi zhao-sso 公众号回调转调接口：
 *   POST /wechat-assistant/handle（**根路径**，Nest 无 API 前缀；
 *   对外经 nginx location 原样透传，同 /wechat/message 机制——
 *   /shop-api/* 前缀下的 POST 会被 Apollo GraphQL 中间件拦截，勿挂）
 *   header: x-zhao-secret（与 strapi 端 ZHAO_SEARCH_SHARED_SECRET 同值）
 *   body:   { openid, text, msgId?, createTime?, channelToken?, boundPhone? }
 *           位置消息：{ openid, msgType: 'location', latitude, longitude, scale?, label? }
 *           或 { openid, location: { latitude, longitude, scale?, label? } }
 *   返回:   { kind: 'text', content } | { kind: 'news', articles: [{title,description,pic_url,url}] }
 *           | { handled: false }（无需回复，sso 回 success）
 *
 * 回复由 sso 侧组装被动回复 XML（受微信 5 秒窗口约束，本接口必须快速返回）。
 * 微信直连回调链路（/wechat/message → 事件总线 → 客服消息）保留为备选，
 * 公众号后台只能配一个回调 URL，生产走 sso 链路。
 */
@Controller('wechat-assistant')
export class AssistantHttpController {
    constructor(private assistantService: AssistantService) {}

    @Post('handle')
    async handle(@Req() req: Request & { body?: any }, @Res() res: Response): Promise<void> {
        const secret = process.env.ZHAO_SEARCH_SHARED_SECRET;
        if (!secret || (req.headers as any)['x-zhao-secret'] !== secret) {
            res.status(403).json({ handled: false, error: 'invalid secret' });
            return;
        }
        const rawBody = (req as any).body;
        let body: Record<string, any> = {};
        try {
            // jsonBridge 中间件已把 body 解析为对象；兼容字符串形式
            body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody || {};
        } catch {
            res.status(400).json({ handled: false, error: 'invalid json body' });
            return;
        }
        const openid = String(body.openid || body.fromUserName || '');
        const text = typeof body.text === 'string' ? body.text : '';
        // 位置消息：支持 sso 透传的 location 子对象，也兼容顶层经纬度
        const locSource = body.location && typeof body.location === 'object' ? body.location : body;
        const latitude = toNumber(locSource.latitude ?? locSource.Latitude ?? body.Latitude);
        const longitude = toNumber(locSource.longitude ?? locSource.Longitude ?? body.Longitude);
        const isLocation =
            String(body.msgType || '').toLowerCase() === 'location' ||
            (latitude !== undefined && longitude !== undefined);
        if (!openid) {
            res.status(400).json({ handled: false, error: 'openid is required' });
            return;
        }
        if (isLocation && !(latitude !== undefined && longitude !== undefined)) {
            res.status(400).json({ handled: false, error: 'latitude and longitude are required' });
            return;
        }
        if (!isLocation && !text) {
            res.status(400).json({ handled: false, error: 'openid and text are required' });
            return;
        }
        const msg: WechatInboundMessage = {
            channelToken: String(body.channelToken || ''),
            msgType: isLocation ? 'location' : 'text',
            fromUserName: openid,
            toUserName: '',
            content: text,
            msgId: body.msgId != null ? String(body.msgId) : undefined,
            createTime: body.createTime != null ? Number(body.createTime) : undefined,
            latitude: isLocation ? latitude : undefined,
            longitude: isLocation ? longitude : undefined,
            scale: toNumber(locSource.scale ?? locSource.Scale),
            label: typeof (locSource.label ?? body.label) === 'string' ? (locSource.label ?? body.label) : undefined,
        };
        // sso 转调附带的绑定用户手机号（路径 A：vendure 未绑定时免输入自动建档）
        const boundPhone = String(body.boundPhone || '').trim() || undefined;
        try {
            // MsgId 幂等：微信重复投递（回调超时重试）不重复建单/重复回复
            if (!(await this.assistantService.claimInboundDedup(msg))) {
                res.json({ handled: false });
                return;
            }
            const out = await this.assistantService.processMessage(msg, { boundPhone });
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

/** 宽松数字转换：空值/非数字返回 undefined */
function toNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
