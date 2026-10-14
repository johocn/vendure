import { ChannelService, RequestContextService, TransactionalConnection } from '@vendure/core';
import { WechatInboundMessage, WechatMessageEvent } from '@vendure/wechat-auth-plugin';
import { CredentialService } from './credential.service';
import { CustomerBindingService } from './customer-binding.service';
import { AssistantOrderService } from './order.service';
import { AssistantSearchService } from './search-adapter';
import { SessionService } from './session.service';
import { OutboundMessage, WechatShoppingAssistantOptions } from './types';
import { WechatSender } from './wechat-sender';
/**
 * 微信购物助手编排器：
 * 回调事件（WechatMessageEvent）→ 去重 → 意图识别 → 搜索/下单 → 客服消息回复。
 * 全链路异步执行且吞掉异常（回调 5 秒内已回 success，超时微信会重试，
 * 重复推送由 MsgId 去重表挡住）。
 */
export declare class AssistantService {
    private opts;
    private connection;
    private sessionService;
    private searchService;
    private orderService;
    private sender;
    private credentialService;
    private channelService;
    private requestContextService;
    private customerBinding;
    constructor(opts: WechatShoppingAssistantOptions, connection: TransactionalConnection, sessionService: SessionService, searchService: AssistantSearchService, orderService: AssistantOrderService, sender: WechatSender, credentialService: CredentialService, channelService: ChannelService, requestContextService: RequestContextService, customerBinding: CustomerBindingService);
    onMessage(event: WechatMessageEvent): Promise<void>;
    /** 事件总线链路（本插件回调直连微信时用）：去重 → 决策 → 客服消息发送 */
    private handle;
    /**
     * 纯决策：意图识别 → 搜索/下单 → 组装出站消息（**不发送**）。
     * 两条链路共用：
     * ① 微信事件总线（本插件回调直连，handle() 负责发送）
     * ② HTTP 接口（strapi zhao-sso 回调转调 POST /wechat-assistant/handle，
     *    回复由 sso 的被动回复 XML 承担——受 5 秒窗口约束，本方法须快速返回）。
     * extra.boundPhone：sso 转调时附带的绑定用户手机号（路径 A：vendure 未绑定时自动建档，免输入）。
     * 返回 null = 无需回复（重复消息 / 非文本 / 未识别事件）。
     */
    processMessage(msg: WechatInboundMessage, extra?: {
        boundPhone?: string;
    }): Promise<OutboundMessage | null>;
    private handleFlowStep;
    private handleSearch;
    private handleOrder;
    /** 建单 + 结果文案（成功附支付链接；库存/变体/失败各回对应提示） */
    private placeOrder;
    /** MsgId 幂等：插入成功=首次处理；唯一键冲突=重复推送，直接跳过 */
    private claimDedup;
    private resolveChannelId;
    private storefront;
    private loginUrl;
    /** 支付确认页：优先模板（hash 路由前端，如 `https://host/#/pkg-order/pages/payment?code={code}`） */
    private payUrl;
}
