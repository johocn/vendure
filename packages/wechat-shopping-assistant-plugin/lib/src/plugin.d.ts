import { Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { AssistantService } from './assistant.service';
import { WechatShoppingAssistantOptions } from './types';
import { WechatSender } from './wechat-sender';
/**
 * 微信公众号购物助手：
 * 用户发「买一瓶酱油」→ meili 商品搜索 → 客服消息图文卡片（失败降级文本列表）
 * → 回复「买1」→ 校验绑定/库存 → 创建订单 → 回复订单确认 + H5 收银台支付链接。
 *
 * 依赖：WechatAuthPlugin（消息回调事件 + 客服消息 API）、MeiliSearchPlugin（商品索引）。
 * 须与 WechatAuthPlugin 同时注册（见 dev-config 条件装配）。
 */
export declare class WechatShoppingAssistantPlugin {
    private options;
    private eventBus;
    private assistantService;
    private sender;
    static options: WechatShoppingAssistantOptions;
    constructor(options: WechatShoppingAssistantOptions, eventBus: EventBus, assistantService: AssistantService, sender: WechatSender);
    static init(options: WechatShoppingAssistantOptions): Type<WechatShoppingAssistantPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
