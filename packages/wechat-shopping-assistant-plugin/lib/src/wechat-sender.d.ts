import { WechatAuthService } from '@vendure/wechat-auth-plugin';
import { OutboundMessage, WechatCredentials } from './types';
/**
 * 微信出站消息封装：news 失败自动降级 text 由调用方编排。
 * outboundMode='echo' 时不调微信 API，仅打印 payload（本地冒烟用）。
 */
export declare class WechatSender {
    private wechatAuth;
    private echoMode;
    constructor(wechatAuth: WechatAuthService);
    /** 由插件初始化时按 options.outboundMode 注入 */
    setEchoMode(echo: boolean): void;
    send(message: OutboundMessage, credentials: WechatCredentials): Promise<void>;
    /** news 发送失败（45166/40007 等）时自动降级纯文本 */
    sendOrFallback(message: OutboundMessage, fallbackText: string, credentials: WechatCredentials): Promise<void>;
}
