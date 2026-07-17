import { RequestContext } from '@vendure/core';
export interface SendSubscribeMessageInput {
    openid: string;
    templateId: string;
    data: Record<string, {
        value: string;
        color?: string;
    }>;
    page?: string;
    miniprogramState?: string;
}
export interface SendSubscribeMessageResult {
    success: boolean;
    msgId?: string;
    error?: string;
}
/**
 * 微信订阅消息发送 Provider 接口。
 * 实现方负责 access_token 获取与订阅消息 API 调用。
 */
export interface WechatMessageProvider {
    getAccessToken(ctx: RequestContext, channelId: string): Promise<string>;
    sendSubscribeMessage(ctx: RequestContext, input: SendSubscribeMessageInput): Promise<SendSubscribeMessageResult>;
}
