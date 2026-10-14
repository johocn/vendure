import { ChannelService } from '@vendure/core';
import { WechatCredentials } from './types';
/**
 * 渠道凭证解析：优先渠道 authConfig.wechat 覆盖（appId/appSecret），
 * 未配置则回退插件级凭证（空 appId → 主公众号）。
 */
export declare class CredentialService {
    private channelService;
    constructor(channelService: ChannelService);
    resolveForChannel(channelToken: string, fallback: WechatCredentials): Promise<WechatCredentials>;
}
