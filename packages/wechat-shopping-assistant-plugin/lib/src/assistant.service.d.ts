import { ChannelService, RequestContextService, TransactionalConnection } from '@vendure/core';
import { WechatMessageEvent } from '@vendure/wechat-auth-plugin';
import { CredentialService } from './credential.service';
import { AssistantOrderService } from './order.service';
import { AssistantSearchService } from './search-adapter';
import { SessionService } from './session.service';
import { WechatShoppingAssistantOptions } from './types';
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
    constructor(opts: WechatShoppingAssistantOptions, connection: TransactionalConnection, sessionService: SessionService, searchService: AssistantSearchService, orderService: AssistantOrderService, sender: WechatSender, credentialService: CredentialService, channelService: ChannelService, requestContextService: RequestContextService);
    onMessage(event: WechatMessageEvent): Promise<void>;
    private handle;
    private handleSearch;
    private handleOrder;
    /** MsgId 幂等：插入成功=首次处理；唯一键冲突=重复推送，直接跳过 */
    private claimDedup;
    private findCustomerByOpenid;
    private resolveChannelId;
    private reply;
    private storefront;
    private loginUrl;
}
