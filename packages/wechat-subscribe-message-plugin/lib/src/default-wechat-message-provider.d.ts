import { RequestContext } from '@vendure/core';
import { SendSubscribeMessageInput, SendSubscribeMessageResult, WechatMessageProvider } from './wechat-message-provider';
/**
 * 默认微信订阅消息 Provider。
 *
 * 微信 appId/appSecret 从 channel.customFields.authConfig 读取
 * （兼容 cjk-plugin 的 TenantAuthConfig struct，字段路径 overrides.wechat.appId/appSecret）。
 * 若 appSecret 被加密（前缀 enc:），使用 AUTH_SECRET 环境变量按 AES-256-GCM 解密，
 * 算法与 cjk-plugin 的 auth/crypto.ts 一致。
 *
 * access_token 按 channelId 缓存于内存，有效期内的 token 直接复用。
 */
export declare class DefaultWechatMessageProvider implements WechatMessageProvider {
    private tokenCache;
    getAccessToken(ctx: RequestContext, channelId: string): Promise<string>;
    sendSubscribeMessage(ctx: RequestContext, input: SendSubscribeMessageInput): Promise<SendSubscribeMessageResult>;
    /**
     * 强制刷新某 channel 的 access_token 缓存（暴露给上层在 401/invalid token 时调用）。
     */
    invalidate(channelId: string): void;
    private readCredentials;
    private maybeDecrypt;
    private getCryptoKey;
}
