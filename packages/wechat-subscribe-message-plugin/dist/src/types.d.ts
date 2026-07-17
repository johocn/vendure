import { Type } from '@nestjs/common';
import { WechatMessageProvider } from './wechat-message-provider';
export interface WechatSubscribeMessagePluginOptions {
    /**
     * 自定义微信消息发送 Provider。未提供时使用 DefaultWechatMessageProvider。
     */
    provider?: Type<WechatMessageProvider>;
    /**
     * 小程序跳转页面（默认值，可被 channel customFields 覆盖）。
     */
    defaultPage?: string;
    /**
     * 小程序版本：developer / trial / formal，默认 formal。
     */
    defaultMiniprogramState?: 'developer' | 'trial' | 'formal';
}
