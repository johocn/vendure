import { Request, Response } from 'express';
import { AssistantService } from './assistant.service';
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
export declare class AssistantHttpController {
    private assistantService;
    constructor(assistantService: AssistantService);
    handle(req: Request & {
        body?: any;
    }, res: Response): Promise<void>;
}
